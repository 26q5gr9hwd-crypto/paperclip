import { api } from "./client";

export interface FileStatus {
  path: string;
  exists: boolean;
  sizeBytes: number | null;
  modifiedAt: string | null;
  content: string | null;
  freshness: "live" | "stale" | "missing";
}

export interface ServiceStatus {
  name: string;
  port: number;
  status: "live" | "disconnected" | "error";
  response: unknown;
  checkedAt: string;
  latencyMs: number;
}

export interface SkillInfo {
  name: string;
  path: string;
  hasSkillMd: boolean;
  description: string | null;
}

export type RuntimeInstructionsKind = "hermes_md" | "agents" | "claude" | "cursorrules";

export interface RuntimeInstructionsCandidate {
  kind: RuntimeInstructionsKind;
  label: string;
  path: string;
  exists: boolean;
  searchScope: "walk_to_git_root" | "cwd_only";
}

export interface RuntimeTruthData {
  checkedAt: string;
  systemFiles: FileStatus[];
  services: ServiceStatus[];
  skills: {
    deerflow: { path: string; skills: SkillInfo[] };
    hermes: { path: string; skills: SkillInfo[] };
    totalCount: number;
  };
  budget: {
    configured: boolean;
    details: string;
    costEventsTable: boolean;
    budgetPoliciesConfigured: string;
  };
  hermesConfig: Record<string, unknown> | null;
  instructions: {
    hermesRuntimeCwd: string | null;
    precedence: string[];
    projectContext: {
      selectedKind: RuntimeInstructionsKind | null;
      selectedLabel: string | null;
      selectedPath: string | null;
      candidates: RuntimeInstructionsCandidate[];
    };
    effectiveSummary: string;
  };
}

export const runtimeTruthApi = {
  get: () => api.get<RuntimeTruthData>("/runtime-truth"),
};
