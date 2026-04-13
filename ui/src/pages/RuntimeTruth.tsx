import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { runtimeTruthApi, type FileStatus, type ServiceStatus, type SkillInfo } from "../api/runtimeTruth";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  Server,
  Wrench,
  DollarSign,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

function FreshnessIcon({ freshness }: { freshness: string }) {
  switch (freshness) {
    case "live":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "stale":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "missing":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-400" />;
  }
}

function ServiceIcon({ status }: { status: string }) {
  switch (status) {
    case "live":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "error":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "disconnected":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-400" />;
  }
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    live: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    stale: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    missing: "bg-red-500/15 text-red-700 border-red-500/30",
    disconnected: "bg-red-500/15 text-red-700 border-red-500/30",
    error: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {label}
    </span>
  );
}

function FilePanel({ file, defaultOpen }: { file: FileStatus; defaultOpen?: boolean }) {
  const fileName = file.path.split("/").pop() || file.path;
  const timeAgo = file.modifiedAt
    ? formatTimeAgo(new Date(file.modifiedAt))
    : null;

  return (
    <details className="group rounded-lg border border-border bg-card" open={defaultOpen && file.exists}>
      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/50">
        <FreshnessIcon freshness={file.freshness} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{fileName}</span>
            <StatusBadge status={file.freshness} label={file.freshness} />
          </div>
          <div className="text-xs text-muted-foreground truncate">{file.path}</div>
        </div>
        <div className="text-xs text-muted-foreground text-right shrink-0">
          {file.exists ? (
            <>
              <div>{file.sizeBytes != null ? `${file.sizeBytes} bytes` : ""}</div>
              {timeAgo && <div>{timeAgo}</div>}
            </>
          ) : (
            <span className="text-red-500 font-medium">Not found</span>
          )}
        </div>
      </summary>
      {file.exists && file.content && (
        <div className="border-t border-border px-4 py-3">
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs font-mono text-muted-foreground bg-muted/30 rounded-md p-3 max-h-64 overflow-y-auto">
            {file.content}
          </pre>
        </div>
      )}
    </details>
  );
}

function ServicePanel({ service }: { service: ServiceStatus }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <ServiceIcon status={service.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{service.name}</span>
          <StatusBadge status={service.status} label={service.status} />
        </div>
        <div className="text-xs text-muted-foreground">
          Port {service.port} · {service.latencyMs}ms
        </div>
      </div>
    </div>
  );
}

function SkillCard({ skill }: { skill: SkillInfo }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2">
      <Wrench className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-medium font-mono">{skill.name}</div>
        {skill.description && (
          <div className="text-xs text-muted-foreground truncate">{skill.description}</div>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          {skill.hasSkillMd ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <Eye className="h-3 w-3" /> SKILL.md
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <EyeOff className="h-3 w-3" /> No SKILL.md
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function RuntimeTruth() {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Runtime Truth" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["runtime-truth"],
    queryFn: () => runtimeTruthApi.get(),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl py-10 px-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load runtime truth: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const soulFile = data.systemFiles.find((f) => f.path.includes("SOUL.md"));
  const configFiles = data.systemFiles.filter((f) => !f.path.includes("SOUL.md"));

  return (
    <div className="mx-auto max-w-4xl py-6 px-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Runtime Truth</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live VPS state — what Friday actually sees and uses.
            {data.checkedAt && (
              <span className="ml-2 text-xs">
                Checked {formatTimeAgo(new Date(data.checkedAt))}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Services */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Services
          </h2>
          <span className="text-xs text-muted-foreground">
            ({data.services.filter((s) => s.status === "live").length}/{data.services.length} live)
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.services.map((service) => (
            <ServicePanel key={service.name} service={service} />
          ))}
        </div>
      </section>

      {/* SOUL.md */}
      {soulFile && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Friday Persona (SOUL.md)
            </h2>
            <StatusBadge status={soulFile.freshness} label={soulFile.freshness} />
          </div>
          <FilePanel file={soulFile} defaultOpen={true} />
        </section>
      )}

      {/* System Config & Markdown Files */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            System Config & Markdown
          </h2>
          <span className="text-xs text-muted-foreground">
            ({configFiles.filter((f) => f.exists).length}/{configFiles.length} present)
          </span>
        </div>
        <div className="space-y-2">
          {configFiles.map((file) => (
            <FilePanel key={file.path} file={file} />
          ))}
        </div>
      </section>

      {/* Hermes Config Summary */}
      {data.hermesConfig && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Hermes Config Summary
            </h2>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(data.hermesConfig).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted-foreground">{key}:</span>{" "}
                  <span className="font-mono text-xs">{String(value ?? "—")}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Skills */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Installed Skills
          </h2>
          <span className="text-xs text-muted-foreground">
            ({data.skills.totalCount} total)
          </span>
        </div>
        {data.skills.deerflow.skills.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">
              DeerFlow Skills ({data.skills.deerflow.path})
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.skills.deerflow.skills.map((skill) => (
                <SkillCard key={skill.name} skill={skill} />
              ))}
            </div>
          </div>
        )}
        {data.skills.hermes.skills.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">
              Hermes Skills ({data.skills.hermes.path})
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.skills.hermes.skills.map((skill) => (
                <SkillCard key={skill.name} skill={skill} />
              ))}
            </div>
          </div>
        )}
        {data.skills.totalCount === 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            No skills found on disk.
          </div>
        )}
      </section>

      {/* Budget */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Budget & Cost Wiring
          </h2>
          <StatusBadge
            status={data.budget.configured ? "live" : "missing"}
            label={data.budget.configured ? "configured" : "not configured"}
          />
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
          <div className="text-sm">{data.budget.details}</div>
          <div className="text-xs text-muted-foreground">
            <strong>Cost events table:</strong>{" "}
            {data.budget.costEventsTable ? (
              <span className="text-emerald-600">Present (per-run cost tracking available)</span>
            ) : (
              <span className="text-red-500">Missing</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            <strong>Budget policies:</strong> {data.budget.budgetPoliciesConfigured}
          </div>
        </div>
      </section>

      {/* Legend */}
      <section className="border-t border-border pt-4">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Live — reflects current VPS state
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-500" /> Stale — exists but may be outdated
          </span>
          <span className="inline-flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-500" /> Missing/Disconnected — not found or unreachable
          </span>
        </div>
      </section>
    </div>
  );
}
