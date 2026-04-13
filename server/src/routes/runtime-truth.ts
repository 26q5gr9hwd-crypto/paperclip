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
      content: content && content.length > 10000 ? content.slice(0, 10000) + "\n...[truncated]" : content,
      freshness: ageHours < 24 ? "live" : ageHours < 168 ? "stale" : "stale",
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

function checkService(name: string, port: number, path: string): Promise<ServiceStatus> {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: "127.0.0.1", port, path, timeout: 3000 },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => {
          const latencyMs = Date.now() - start;
          let response: unknown = body;
          try { response = JSON.parse(body); } catch { /* keep as string */ }
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
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => {
        const skillDir = path.join(dirPath, e.name);
        const skillMdPath = path.join(skillDir, "SKILL.md");
        const hasSkillMd = fs.existsSync(skillMdPath);
        let description: string | null = null;
        if (hasSkillMd) {
          try {
            const content = fs.readFileSync(skillMdPath, "utf-8");
            const firstLine = content.split("\n").find((l) => l.trim().length > 0);
            description = firstLine?.replace(/^#+\s*/, "").trim() ?? null;
          } catch { /* ignore */ }
        }
        return { name: e.name, path: skillDir, hasSkillMd, description };
      });
  } catch {
    return [];
  }
}

export function runtimeTruthRoutes() {
  const router = Router();

  router.get("/", async (_req, res) => {
    const checkedAt = new Date().toISOString();

    // 1. System markdown files
    const systemFiles: FileStatus[] = [
      readFileStatus("/root/.hermes/SOUL.md"),
      readFileStatus("/root/.hermes/HERMES.md"),
      readFileStatus("/root/.hermes/AGENTS.md"),
      readFileStatus("/root/AGENTS.md"),
      readFileStatus("/root/.hermes/config.yaml"),
      readFileStatus("/root/.paperclip/instances/default/config.json"),
    ];

    // 2. Service health
    const services = await Promise.all([
      checkService("Paperclip (self)", 3100, "/api/health"),
      checkService("DeerFlow Gateway", 8001, "/health"),
      checkService("LangGraph", 2024, "/ok"),
      checkService("Hindsight", 8888, "/health"),
      checkService("OpenViking", 1933, "/health"),
    ]);

    // 3. Skills
    const deerflowSkills = listSkills("/opt/deer-flow/skills/custom/");
    const hermesSkills = listSkills("/root/.hermes/skills/");
    const skills = {
      deerflow: { path: "/opt/deer-flow/skills/custom/", skills: deerflowSkills },
      hermes: { path: "/root/.hermes/skills/", skills: hermesSkills },
      totalCount: deerflowSkills.length + hermesSkills.length,
    };

    // 4. Budget / cost config
    const paperclipConfig = readFileStatus("/root/.paperclip/instances/default/config.json", true);
    let budgetConfigured = false;
    let budgetDetails = "No Paperclip config found";
    if (paperclipConfig.exists && paperclipConfig.content) {
      try {
        const cfg = JSON.parse(paperclipConfig.content);
        budgetConfigured = !!(cfg.budget || cfg.billing || cfg.costTracking);
        budgetDetails = budgetConfigured
          ? "Budget configuration found in Paperclip config"
          : "No budget/billing/costTracking section in Paperclip config. Cost events are tracked per-run via the Paperclip cost_events table, but no budget limits or alerts are configured.";
      } catch {
        budgetDetails = "Could not parse Paperclip config JSON";
      }
    }

    const budget: BudgetStatus = {
      configured: budgetConfigured,
      details: budgetDetails,
      costEventsTable: true, // Paperclip has a cost_events table by default
      budgetPoliciesConfigured: "Check via Paperclip UI > Costs page. No aggregate budget limits are wired by default.",
    };

    // 5. Hermes config summary
    let hermesConfigSummary: Record<string, unknown> | null = null;
    const hermesConfig = systemFiles.find((f) => f.path === "/root/.hermes/config.yaml");
    if (hermesConfig?.exists && hermesConfig.content) {
      // Extract key fields from YAML without a parser
      const lines = hermesConfig.content.split("\n");
      const extractField = (key: string) => {
        const line = lines.find((l) => l.trimStart().startsWith(key + ":"));
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
    });
  });

  return router;
}
