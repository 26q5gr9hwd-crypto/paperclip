import { api } from "./client";

export interface ContextComponent {
  name: string;
  category: string;
  present: boolean;
  size: number | null;
  freshness: string;
  notes: string | null;
}

export interface RuntimeFile {
  path: string;
  exists: boolean;
  sizeBytes: number | null;
  modifiedAt: string | null;
  snippet: string | null;
}

export interface RunEvent {
  seq: number;
  eventType: string;
  stream: string | null;
  level: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface RunContextSnapshot {
  runId: string;
  agentId: string;
  agentName: string;
  adapterType: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  invocationSource: string;
  triggerDetail: string | null;
  adapterPrompt: string | null;
  adapterContext: Record<string, unknown> | null;
  adapterEnv: Record<string, unknown> | null;
  adapterCommand: string | null;
  adapterArgs: string[] | null;
  adapterCwd: string | null;
  effectiveToolsets: string[] | null;
  issueContext: Record<string, unknown> | null;
  events: RunEvent[];
  runtimeFiles: RuntimeFile[];
  contextBreakdown: ContextComponent[];
  inspectedAt: string;
}

export interface RunListItem {
  id: string;
  status: string;
  invocationSource: string;
  triggerDetail: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  hasContextSnapshot: boolean;
}

export const runContextApi = {
  getRunContext: (agentId: string, runId: string) =>
    api.get<RunContextSnapshot>("/run-context/agents/" + agentId + "/runs/" + runId),
  listRuns: (agentId: string, limit = 20) =>
    api.get<{ agentId: string; runs: RunListItem[] }>(
      "/run-context/agents/" + agentId + "/runs?limit=" + limit,
    ),
};
