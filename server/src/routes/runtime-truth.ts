import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

interface FileStatus {
  path: string;
  exists: boolean;
  sizeBytes: number | null;
  modifiedAt: string | null;
  content: string | null;
  freshness: "live" | "stale" | "missing";
}

interface ServiceStatus {
  name: string;
  port: number;
  status: "live" | "disconnected" | "error";
  response: unknown | null;
  checkedAt: string;
  latencyMs: number;
}

interface SkillInfo {
  name: string;
  path: string;
  hasSkillMd: boolean;
  description: string | null;
}

interface BudgetStatus {
  configured: boolean;
  details: string;
  costEventsTable: boolean;
  budgetPoliciesConfigured: string;
}

type ProjectContextKind = "hermes_md" | "agents" | "claude" | "cursorrules";

interface RuntimeInstructionsCandidate {
  kind: ProjectContextKind;
  label: string;
  path: string;
  exists: boolean;
  searchScope: "walk_to_git_root" | "cwd_only";
}

interface RuntimeInstructionsSummary {
  hermesRuntimeCwd: string | null;
  precedence: string[];
  projectContext: {
    selectedKind: ProjectContextKind | null;
    selectedLabel: string | null;
    selectedPath: string | null;
    candidates: RuntimeInstructionsCandidate[];
  };
  effectiveSummary: string;
}

function readFileStatus(filePath: string, includeContent = true): FileStatus {
  try {
    const stat = fs.statSync(filePath);
    const content = includeContent ? fs.readFileSync(filePath, "utf-8") : null;
    const now = Date.now();
    const modifiedMs = stat.mtimeMs;
    const ageHours = (now - modifiedMs) / (1000 * 60 * 60);
    return {
      path: filePath,
      exists: true,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      content: content && content.length > 10000 ? `${content.slice(0, 10000)}\n...[truncated]` : content,
      freshness: ageHours < 24 ? "live" : "stale",
    };
  } catch {
    return {
      path: filePath,
      exists: false,
      sizeBytes: null,
      modifiedAt: null,
      content: null,
      freshness: "missing",
    };
  }
}

function checkService(name: string, port: number, requestPath: string): Promise<ServiceStatus> {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: "127.0.0.1", port, path: requestPath, timeout: 3000 },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => {
          const latencyMs = Date.now() - start;
          let response: unknown = body;
          try {
            response = JSON.parse(body);
          } catch {
            // keep plain text response
          }
          resolve({
            name,
            port,
            status: res.statusCode && res.statusCode < 400 ? "live" : "error",
            response,
            checkedAt: new Date().toISOString(),
            latencyMs,
          });
        });
      },
    );
    req.on("error", () => {
      resolve({
        name,
        port,
        status: "disconnected",
        response: null,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({
        name,
        port,
        status: "disconnected",
        response: null,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
      });
    });
  });
}

function listSkills(dirPath: string): SkillInfo[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => {
        const skillDir = path.join(dirPath, entry.name);
        const skillMdPath = path.join(skillDir, "SKILL.md");
        const hasSkillMd = fs.existsSync(skillMdPath);
        let description: string | null = null;
        if (hasSkillMd) {
          try {
            const content = fs.readFileSync(skillMdPath, "utf-8");
            const firstLine = content.split("\n").find((line) => line.trim().length > 0);
            description = firstLine?.replace(/^#+\s*/, "").trim() ?? null;
          } catch {
            // ignore skill read errors
          }
        }
        return { name: entry.name, path: skillDir, hasSkillMd, description };
      });
  } catch {
    return [];
  }
}

function findHermesRuntimeCwd(): string | null {
  try {
    const procEntries = fs.readdirSync("/proc", { withFileTypes: true });
    for (const entry of procEntries) {
      if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
      const cmdlinePath = path.join("/proc", entry.name, "cmdline");
      try {
        const cmdline = fs.readFileSync(cmdlinePath, "utf-8").replace(/\u0000/g, " ");
        if (!cmdline.includes("hermes_cli.main") || !cmdline.includes("gateway") || !cmdline.includes("run")) {
          continue;
        }
        return fs.realpathSync(path.join("/proc", entry.name, "cwd"));
      } catch {
        // ignore transient proc failures
      }
    }
  } catch {
    // ignore proc scan failures
  }
  return null;
}

function findGitRoot(startPath: string): string | null {
  let current = path.resolve(startPath);
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function findFirstExistingFile(filePaths: string[]): string | null {
  for (const filePath of filePaths) {
    try {
      if (fs.statSync(filePath).isFile()) return filePath;
    } catch {
      // ignore missing files
    }
  }
  return null;
}

function findCursorRulesPath(cwd: string): string | null {
  const plainRules = path.join(cwd, ".cursorrules");
  try {
    if (fs.statSync(plainRules).isFile()) return plainRules;
  } catch {
    // ignore
  }

  const rulesDir = path.join(cwd, ".cursor", "rules");
  try {
    const entries = fs.readdirSync(rulesDir, { withFileTypes: true });
    const firstRule = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mdc"))
      .sort((a, b) => a.name.localeCompare(b.name))[0];
    if (firstRule) return path.join(rulesDir, firstRule.name);
  } catch {
    // ignore
  }

  return null;
}

function buildInstructionsSummary(hermesRuntimeCwd: string | null): RuntimeInstructionsSummary {
  const precedence = [
    ".hermes.md / HERMES.md",
    "AGENTS.md / agents.md",
    "CLAUDE.md / claude.md",
    ".cursorrules / .cursor/rules/*.mdc",
  ];

  if (!hermesRuntimeCwd) {
    return {
      hermesRuntimeCwd: null,
      precedence,
      projectContext: {
        selectedKind: null,
        selectedLabel: null,
        selectedPath: null,
        candidates: [],
      },
      effectiveSummary:
        "Hermes runtime process was not detected, so the live project-context path could not be confirmed.",
    };
  }

  const cwd = path.resolve(hermesRuntimeCwd);
  const gitRoot = findGitRoot(cwd);

  let hermesMdPath: string | null = null;
  let current = cwd;
  while (true) {
    hermesMdPath = findFirstExistingFile([
      path.join(current, ".hermes.md"),
      path.join(current, "HERMES.md"),
    ]);
    if (hermesMdPath) break;
    if ((gitRoot && current === gitRoot) || path.dirname(current) === current) break;
    current = path.dirname(current);
  }

  const agentsPath = findFirstExistingFile([
    path.join(cwd, "AGENTS.md"),
    path.join(cwd, "agents.md"),
  ]);
  const claudePath = findFirstExistingFile([
    path.join(cwd, "CLAUDE.md"),
    path.join(cwd, "claude.md"),
  ]);
  const cursorRulesPath = findCursorRulesPath(cwd);

  const candidates: RuntimeInstructionsCandidate[] = [
    {
      kind: "hermes_md",
      label: ".hermes.md / HERMES.md",
      path: hermesMdPath ?? path.join(cwd, "HERMES.md"),
      exists: Boolean(hermesMdPath),
      searchScope: "walk_to_git_root",
    },
    {
      kind: "agents",
      label: "AGENTS.md / agents.md",
      path: agentsPath ?? path.join(cwd, "AGENTS.md"),
      exists: Boolean(agentsPath),
      searchScope: "cwd_only",
    },
    {
      kind: "claude",
      label: "CLAUDE.md / claude.md",
      path: claudePath ?? path.join(cwd, "CLAUDE.md"),
      exists: Boolean(claudePath),
      searchScope: "cwd_only",
    },
    {
      kind: "cursorrules",
      label: ".cursorrules / .cursor/rules/*.mdc",
      path: cursorRulesPath ?? path.join(cwd, ".cursorrules"),
      exists: Boolean(cursorRulesPath),
      searchScope: "cwd_only",
    },
  ];

  const selected = candidates.find((candidate) => candidate.exists) ?? null;
  const effectiveSummary = selected
    ? `Hermes runs from ${cwd} and currently loads ${selected.label} at ${selected.path}. SOUL.md is loaded separately from /root/.hermes/SOUL.md.`
    : `Hermes runs from ${cwd}. SOUL.md is loaded separately from /root/.hermes/SOUL.md, and no project-context file was detected in the current precedence chain.`;

  return {
    hermesRuntimeCwd: cwd,
    precedence,
    projectContext: {
      selectedKind: selected?.kind ?? null,
      selectedLabel: selected?.label ?? null,
      selectedPath: selected?.path ?? null,
      candidates,
    },
    effectiveSummary,
  };
}

export function runtimeTruthRoutes() {
  const router = Router();

  router.get("/", async (_req, res) => {
    const checkedAt = new Date().toISOString();
    const instructions = buildInstructionsSummary(findHermesRuntimeCwd());

    const systemFilePaths = [
      "/root/.hermes/SOUL.md",
      "/root/.hermes/HERMES.md",
      "/root/.hermes/AGENTS.md",
      "/root/AGENTS.md",
      "/root/.hermes/config.yaml",
      "/root/.paperclip/instances/default/config.json",
      instructions.projectContext.selectedPath,
    ].filter((value, index, items): value is string => Boolean(value) && items.indexOf(value) === index);

    const systemFiles: FileStatus[] = systemFilePaths.map((filePath) => readFileStatus(filePath));

    const services = await Promise.all([
      checkService("Paperclip (self)", 3100, "/api/health"),
      checkService("DeerFlow Gateway", 8001, "/health"),
      checkService("LangGraph", 2024, "/ok"),
      checkService("Hindsight", 8888, "/health"),
      checkService("OpenViking", 1933, "/health"),
    ]);

    const deerflowSkills = listSkills("/opt/deer-flow/skills/custom/");
    const hermesSkills = listSkills("/root/.hermes/skills/");
    const skills = {
      deerflow: { path: "/opt/deer-flow/skills/custom/", skills: deerflowSkills },
      hermes: { path: "/root/.hermes/skills/", skills: hermesSkills },
      totalCount: deerflowSkills.length + hermesSkills.length,
    };

    const paperclipConfig = readFileStatus("/root/.paperclip/instances/default/config.json", true);
    let budgetConfigured = false;
    let budgetDetails = "No Paperclip config found";
    if (paperclipConfig.exists && paperclipConfig.content) {
      try {
        const cfg = JSON.parse(paperclipConfig.content);
        budgetConfigured = Boolean(cfg.budget || cfg.billing || cfg.costTracking);
        budgetDetails = budgetConfigured
          ? "Budget configuration found in Paperclip config"
          : "No budget, billing, or costTracking section in Paperclip config. Cost events exist, but no budget limits or alerts are configured.";
      } catch {
        budgetDetails = "Could not parse Paperclip config JSON";
      }
    }

    const budget: BudgetStatus = {
      configured: budgetConfigured,
      details: budgetDetails,
      costEventsTable: true,
      budgetPoliciesConfigured: "Check the Paperclip Costs surface. No aggregate budget policies are wired by default.",
    };

    let hermesConfigSummary: Record<string, unknown> | null = null;
    const hermesConfig = systemFiles.find((file) => file.path === "/root/.hermes/config.yaml");
    if (hermesConfig?.exists && hermesConfig.content) {
      const lines = hermesConfig.content.split("\n");
      const extractField = (key: string) => {
        const line = lines.find((value) => value.trimStart().startsWith(`${key}:`));
        return line ? line.split(":").slice(1).join(":").trim() : null;
      };
      hermesConfigSummary = {
        model: extractField("default"),
        memoryProvider: extractField("provider"),
        configVersion: extractField("_config_version"),
        gateway: extractField("gateway"),
      };
    }

    res.json({
      checkedAt,
      systemFiles,
      services,
      skills,
      budget,
      hermesConfig: hermesConfigSummary,
      instructions,
    });
  });

  return router;
}
