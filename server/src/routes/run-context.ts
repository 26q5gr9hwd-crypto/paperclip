import { Router } from "express";
import fs from "node:fs";
import type { Db } from "@paperclipai/db";
import { heartbeatRuns, heartbeatRunEvents, agents } from "@paperclipai/db";
import { and, asc, eq, desc } from "drizzle-orm";

function readFileInfo(filePath: string, snippetLines = 30) {
  try {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const snippet = lines.length > snippetLines
      ? lines.slice(0, snippetLines).join("\n") + "\n...[" + (lines.length - snippetLines) + " more lines]"
      : content;
    return {
      exists: true,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      snippet: snippet.length > 5000 ? snippet.slice(0, 5000) + "\n...[truncated]" : snippet,
    };
  } catch {
    return { exists: false, sizeBytes: null, modifiedAt: null, snippet: null };
  }
}

function buildContextBreakdown(
  prompt: string | null,
  env: Record<string, unknown> | null,
  runtimeFiles: Array<{ path: string; exists: boolean; sizeBytes: number | null }>,
) {
  const components: Array<{name:string;category:string;present:boolean;size:number|null;freshness:string;notes:string|null}> = [];

  components.push({
    name: "Adapter Prompt (Paperclip to Hermes)",
    category: "adapter_prompt",
    present: !!prompt,
    size: prompt?.length ?? null,
    freshness: prompt ? "captured" : "missing",
    notes: prompt
      ? prompt.length + " chars of adapter-built prompt injected as the Hermes query"
      : "No adapter prompt captured",
  });

  const soulMd = runtimeFiles.find((f) => f.path.includes("SOUL.md") && f.path.includes(".hermes"));
  components.push({
    name: "SOUL.md (Friday persona)",
    category: "system_file",
    present: soulMd?.exists ?? false,
    size: soulMd?.sizeBytes ?? null,
    freshness: soulMd?.exists ? "live" : "missing",
    notes: soulMd?.exists
      ? soulMd.sizeBytes + " bytes loaded by Hermes at startup as identity context"
      : "Missing: Hermes falls back to generic DEFAULT_AGENT_IDENTITY",
  });

  const hermesAgentsMd = runtimeFiles.find((f) => f.path === "/root/.hermes/AGENTS.md");
  const rootAgentsMd = runtimeFiles.find((f) => f.path === "/root/AGENTS.md");
  components.push({
    name: "AGENTS.md / Project Context",
    category: "system_file",
    present: (hermesAgentsMd?.exists || rootAgentsMd?.exists) ?? false,
    size: hermesAgentsMd?.sizeBytes ?? rootAgentsMd?.sizeBytes ?? null,
    freshness: (hermesAgentsMd?.exists || rootAgentsMd?.exists) ? "live" : "missing",
    notes: !hermesAgentsMd?.exists && !rootAgentsMd?.exists
      ? "No AGENTS.md found: Friday runs without project context"
      : (hermesAgentsMd?.sizeBytes ?? rootAgentsMd?.sizeBytes) + " bytes",
  });

  const configYaml = runtimeFiles.find((f) => f.path.includes("config.yaml"));
  components.push({
    name: "Hermes config.yaml",
    category: "config",
    present: configYaml?.exists ?? false,
    size: configYaml?.sizeBytes ?? null,
    freshness: configYaml?.exists ? "live" : "missing",
    notes: configYaml?.exists
      ? configYaml.sizeBytes + " bytes: model, toolsets, memory provider defined here"
      : "Missing: Hermes uses defaults",
  });

  const toolsetsFromEnv = env?.HERMES_TOOLSETS;
  components.push({
    name: "Effective Toolsets",
    category: "toolset",
    present: !!toolsetsFromEnv,
    size: null,
    freshness: toolsetsFromEnv ? "captured" : "missing",
    notes: toolsetsFromEnv
      ? "Toolsets passed via env: " + toolsetsFromEnv
      : "Toolsets not explicitly set in env: Hermes uses adapter config defaults",
  });

  components.push({
    name: "OpenViking Memory Recall",
    category: "invisible",
    present: false, size: null, freshness: "missing",
    notes: "BLIND SPOT: OpenViking recall content is injected by Hermes at runtime. Not captured per-run.",
  });

  components.push({
    name: "Hermes System Prompt Assembly",
    category: "invisible",
    present: false, size: null, freshness: "missing",
    notes: "BLIND SPOT: Full system prompt (identity + memory guidance + tool enforcement + skills index) assembled inside Hermes.",
  });

  components.push({
    name: "Skills Index",
    category: "invisible",
    present: false, size: null, freshness: "missing",
    notes: "BLIND SPOT: Hermes loads skill frontmatter from ~/.hermes/skills/ into system prompt. Not captured per-run.",
  });

  return components;
}

export function runContextRoutes(db: Db) {
  const router = Router();

  router.get("/agents/:agentId/runs/:runId", async (req, res) => {
    const { agentId, runId } = req.params;
    try {
      const [run] = await db.select().from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.id, runId), eq(heartbeatRuns.agentId, agentId)))
        .limit(1);
      if (!run) { res.status(404).json({ error: "Run not found" }); return; }

      const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);

      const events = await db.select().from(heartbeatRunEvents)
        .where(eq(heartbeatRunEvents.runId, runId))
        .orderBy(asc(heartbeatRunEvents.seq));

      const invokeEvent = events.find((e) => e.eventType === "adapter.invoke");
      const p = invokeEvent?.payload as Record<string, unknown> | null | undefined;

      const adapterPrompt = typeof p?.prompt === "string" ? p.prompt : null;
      const adapterEnv = typeof p?.env === "object" && p?.env ? p.env as Record<string, unknown> : null;
      const adapterCommand = typeof p?.command === "string" ? p.command : null;
      const adapterArgs = Array.isArray(p?.commandArgs) ? p!.commandArgs as string[] : null;
      const adapterCwd = typeof p?.cwd === "string" ? p.cwd : null;
      const adapterContext = typeof p?.context === "object" && p?.context ? p.context as Record<string, unknown> : null;

      let effectiveToolsets: string[] | null = null;
      if (adapterArgs) {
        const tIdx = adapterArgs.indexOf("-t");
        const tlIdx = adapterArgs.indexOf("--toolsets");
        const idx = tIdx >= 0 ? tIdx : tlIdx;
        if (idx >= 0 && idx + 1 < adapterArgs.length) {
          effectiveToolsets = adapterArgs[idx + 1].split(",").map((s) => s.trim());
        }
      }

      const runtimeFilePaths = [
        "/root/.hermes/SOUL.md", "/root/.hermes/HERMES.md",
        "/root/.hermes/AGENTS.md", "/root/AGENTS.md",
        "/root/.hermes/config.yaml", "/root/.paperclip/instances/default/config.json",
      ];
      const runtimeFiles = runtimeFilePaths.map((fp) => ({ path: fp, ...readFileInfo(fp) }));
      const contextBreakdown = buildContextBreakdown(adapterPrompt, adapterEnv, runtimeFiles);

      res.json({
        runId: run.id, agentId: run.agentId,
        agentName: agent?.name ?? "Unknown",
        adapterType: (agent as Record<string, unknown>)?.adapterType ?? "unknown",
        status: run.status,
        startedAt: run.startedAt?.toISOString() ?? null,
        finishedAt: run.finishedAt?.toISOString() ?? null,
        exitCode: run.exitCode,
        sessionIdBefore: run.sessionIdBefore, sessionIdAfter: run.sessionIdAfter,
        invocationSource: run.invocationSource, triggerDetail: run.triggerDetail,
        adapterPrompt, adapterContext, adapterEnv,
        adapterCommand, adapterArgs, adapterCwd,
        effectiveToolsets,
        issueContext: run.contextSnapshot,
        events: events.map((e) => ({
          seq: e.seq, eventType: e.eventType, stream: e.stream,
          level: e.level, message: e.message, payload: e.payload,
          createdAt: e.createdAt.toISOString(),
        })),
        runtimeFiles, contextBreakdown,
        inspectedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to inspect run context", detail: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/agents/:agentId/runs", async (req, res) => {
    const { agentId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    try {
      const runs = await db.select({
        id: heartbeatRuns.id, status: heartbeatRuns.status,
        invocationSource: heartbeatRuns.invocationSource,
        triggerDetail: heartbeatRuns.triggerDetail,
        startedAt: heartbeatRuns.startedAt,
        finishedAt: heartbeatRuns.finishedAt,
        exitCode: heartbeatRuns.exitCode,
        contextSnapshot: heartbeatRuns.contextSnapshot,
      }).from(heartbeatRuns)
        .where(eq(heartbeatRuns.agentId, agentId))
        .orderBy(desc(heartbeatRuns.createdAt))
        .limit(limit);

      res.json({
        agentId,
        runs: runs.map((r) => ({
          ...r,
          startedAt: r.startedAt?.toISOString() ?? null,
          finishedAt: r.finishedAt?.toISOString() ?? null,
          hasContextSnapshot: !!r.contextSnapshot,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list runs", detail: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
