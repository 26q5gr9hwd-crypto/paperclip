import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import type { RunContextSnapshot, RunListItem } from "../api/runContext";
import { runContextApi } from "../api/runContext";
import {
  Eye, EyeOff, ChevronDown, ChevronRight, ArrowLeft,
  CheckCircle2, XCircle, AlertTriangle, Clock, FileText,
} from "lucide-react";

// ── Collapsible Section ──────────────────────────────────────────────
function Section({ title, icon, defaultOpen = false, badge, children }: {
  title: string; icon?: React.ReactNode; defaultOpen?: boolean;
  badge?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg mb-3">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-t-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {icon}
        <span className="font-medium text-sm">{title}</span>
        {badge && <span className="ml-auto">{badge}</span>}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

// ── Context Breakdown Card ───────────────────────────────────────────
function ContextCard({ c }: { c: RunContextSnapshot["contextBreakdown"][0] }) {
  const statusIcon = c.present
    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : c.category === "invisible"
      ? <AlertTriangle className="h-4 w-4 text-amber-500" />
      : <XCircle className="h-4 w-4 text-red-400" />;
  const bgClass = c.present
    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
    : c.category === "invisible"
      ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";

  return (
    <div className={cn("border rounded-lg p-3 mb-2", bgClass)}>
      <div className="flex items-center gap-2 mb-1">
        {statusIcon}
        <span className="font-medium text-sm">{c.name}</span>
        {c.size !== null && (
          <Badge variant="outline" className="ml-auto text-xs">
            {c.size > 1024 ? (c.size / 1024).toFixed(1) + " KB" : c.size + (c.category === "adapter_prompt" ? " chars" : " B")}
          </Badge>
        )}
      </div>
      {c.notes && <p className="text-xs text-zinc-600 dark:text-zinc-400 ml-6">{c.notes}</p>}
    </div>
  );
}

// ── Run Selector ─────────────────────────────────────────────────────
function RunSelector({ agentId, currentRunId, onSelect }: {
  agentId: string; currentRunId?: string;
  onSelect: (runId: string) => void;
}) {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    runContextApi.listRuns(agentId, 30).then((res) => {
      setRuns((res as unknown as { data: { runs: RunListItem[] } }).data?.runs ?? []);
    }).catch(() => setRuns([])).finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return <div className="text-xs text-zinc-500 p-2">Loading runs...</div>;
  if (!runs.length) return <div className="text-xs text-zinc-500 p-2">No runs found for this agent.</div>;

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      {runs.map((r) => (
        <button
          key={r.id}
          className={cn(
            "w-full text-left px-3 py-2 rounded text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2",
            r.id === currentRunId && "bg-zinc-100 dark:bg-zinc-800 font-medium",
          )}
          onClick={() => onSelect(r.id)}
        >
          <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
            {r.status}
          </Badge>
          <span className="truncate flex-1">{r.invocationSource}</span>
          <span className="text-zinc-400">{r.startedAt ? new Date(r.startedAt).toLocaleString() : "—"}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function RunContextInspector() {
  const { agentId, runId } = useParams<{ agentId: string; runId?: string }>();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<RunContextSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRunSelector, setShowRunSelector] = useState(!runId);

  useEffect(() => {
    if (!agentId || !runId) return;
    setLoading(true);
    setError(null);
    runContextApi.getRunContext(agentId, runId).then((res) => {
      setSnapshot((res as unknown as { data: RunContextSnapshot }).data ?? res as unknown as RunContextSnapshot);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load run context");
    }).finally(() => setLoading(false));
  }, [agentId, runId]);

  const handleRunSelect = (selectedRunId: string) => {
    navigate("/run-context/" + agentId + "/" + selectedRunId);
    setShowRunSelector(false);
  };

  if (!agentId) return <div className="p-8 text-center text-zinc-500">No agent specified.</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Run Context Inspector</h1>
          <p className="text-sm text-zinc-500">
            FRI-H39: Per-run observability for actual delivered context
          </p>
        </div>
      </div>

      {/* Run selector toggle */}
      <div className="mb-4">
        <Button variant="outline" size="sm" onClick={() => setShowRunSelector(!showRunSelector)}>
          {showRunSelector ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          {showRunSelector ? "Hide" : "Select"} Run
        </Button>
        {showRunSelector && (
          <div className="mt-2 border rounded-lg p-2">
            <RunSelector agentId={agentId} currentRunId={runId} onSelect={handleRunSelect} />
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 p-8">
          <Clock className="h-4 w-4 animate-spin" /> Loading run context...
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {snapshot && (
        <div className="space-y-4">
          {/* Run metadata */}
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-zinc-500 text-xs block">Status</span>
                <Badge variant={snapshot.status === "completed" ? "default" : snapshot.status === "failed" ? "destructive" : "secondary"}>
                  {snapshot.status}
                </Badge>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block">Agent</span>
                <span className="font-medium">{snapshot.agentName}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block">Source</span>
                <span>{snapshot.invocationSource}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block">Exit Code</span>
                <span>{snapshot.exitCode ?? "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block">Started</span>
                <span>{snapshot.startedAt ? new Date(snapshot.startedAt).toLocaleString() : "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block">Finished</span>
                <span>{snapshot.finishedAt ? new Date(snapshot.finishedAt).toLocaleString() : "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block">Trigger</span>
                <span className="truncate">{snapshot.triggerDetail ?? "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block">Adapter</span>
                <span>{snapshot.adapterType}</span>
              </div>
            </div>
          </div>

          {/* Context Breakdown — the key deliverable */}
          <Section title="Context Breakdown" icon={<Eye className="h-4 w-4" />} defaultOpen={true}
            badge={
              <div className="flex gap-1">
                <Badge variant="default" className="text-[10px]">
                  {snapshot.contextBreakdown.filter(c => c.present).length} visible
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {snapshot.contextBreakdown.filter(c => !c.present && c.category !== "invisible").length} missing
                </Badge>
                <Badge className="text-[10px] bg-amber-100 text-amber-800">
                  {snapshot.contextBreakdown.filter(c => c.category === "invisible").length} blind spots
                </Badge>
              </div>
            }
          >
            {snapshot.contextBreakdown.map((c, i) => <ContextCard key={i} c={c} />)}
          </Section>

          {/* Adapter Prompt */}
          <Section title="Adapter Prompt" icon={<FileText className="h-4 w-4" />}
            badge={snapshot.adapterPrompt ? <Badge variant="outline" className="text-[10px]">{snapshot.adapterPrompt.length} chars</Badge> : null}
          >
            {snapshot.adapterPrompt ? (
              <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap font-mono">
                {snapshot.adapterPrompt}
              </pre>
            ) : (
              <p className="text-sm text-zinc-500">No adapter prompt captured for this run.</p>
            )}
          </Section>

          {/* Effective Toolsets */}
          <Section title="Effective Toolsets">
            {snapshot.effectiveToolsets ? (
              <div className="flex flex-wrap gap-2">
                {snapshot.effectiveToolsets.map((t, i) => (
                  <Badge key={i} variant="outline">{t}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No explicit toolsets captured. Hermes uses adapter config defaults.</p>
            )}
          </Section>

          {/* Adapter Command */}
          <Section title="Adapter Command">
            <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto whitespace-pre-wrap font-mono">
              {snapshot.adapterCommand ?? "unknown"} {(snapshot.adapterArgs ?? []).join(" ")}
            </pre>
            {snapshot.adapterCwd && (
              <p className="text-xs text-zinc-500 mt-1">cwd: {snapshot.adapterCwd}</p>
            )}
          </Section>

          {/* Environment */}
          <Section title="Environment Variables (redacted)">
            {snapshot.adapterEnv ? (
              <div className="space-y-1">
                {Object.entries(snapshot.adapterEnv).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs font-mono">
                    <span className="text-zinc-500 min-w-[200px]">{k}</span>
                    <span className="text-zinc-300 truncate">
                      {typeof v === "string" && v.includes("***") ? "••••••" : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No environment captured.</p>
            )}
          </Section>

          {/* Runtime Files */}
          <Section title="Runtime Files (current state)">
            {snapshot.runtimeFiles.map((f, i) => (
              <div key={i} className="mb-2 border rounded p-2">
                <div className="flex items-center gap-2 text-xs">
                  {f.exists
                    ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                    : <XCircle className="h-3 w-3 text-red-400" />
                  }
                  <span className="font-mono">{f.path}</span>
                  {f.sizeBytes !== null && <Badge variant="outline" className="text-[10px] ml-auto">{f.sizeBytes} B</Badge>}
                </div>
                {f.snippet && (
                  <pre className="text-[10px] bg-zinc-900 text-zinc-300 rounded p-2 mt-1 overflow-auto max-h-32 whitespace-pre-wrap font-mono">
                    {f.snippet}
                  </pre>
                )}
              </div>
            ))}
          </Section>

          {/* Run Events */}
          <Section title={"Run Events (" + snapshot.events.length + ")"}>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {snapshot.events.map((e, i) => (
                <div key={i} className={cn(
                  "flex gap-2 text-xs font-mono p-1 rounded",
                  e.eventType === "adapter.invoke" && "bg-blue-50 dark:bg-blue-900/20",
                  e.level === "error" && "bg-red-50 dark:bg-red-900/20",
                )}>
                  <span className="text-zinc-400 w-8 text-right shrink-0">#{e.seq}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{e.eventType}</Badge>
                  <span className="truncate text-zinc-600 dark:text-zinc-400">{e.message ?? "—"}</span>
                  <span className="text-zinc-400 ml-auto shrink-0">
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Inspected at */}
          <p className="text-xs text-zinc-400 text-right">
            Inspected at {new Date(snapshot.inspectedAt).toLocaleString()}
          </p>
        </div>
      )}

      {!snapshot && !loading && !error && !runId && (
        <div className="text-center text-zinc-500 p-12">
          <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Select a run above to inspect its delivered context.</p>
        </div>
      )}
    </div>
  );
}
