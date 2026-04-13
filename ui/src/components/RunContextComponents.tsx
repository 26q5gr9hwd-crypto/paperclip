import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { cn } from "../lib/utils";
import type { RunContextSnapshot } from "../api/runContext";
import { runContextApi } from "../api/runContext";
import {
  ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Clock, Layers,
} from "lucide-react";

// ── Collapsible Section ──────────────────────────────────────────────
export function ContextSection({ title, icon, defaultOpen = false, badge, children }: {
  title: string; icon?: React.ReactNode; defaultOpen?: boolean;
  badge?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg mb-2">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-t-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {icon}
        <span className="font-medium text-xs">{title}</span>
        {badge && <span className="ml-auto">{badge}</span>}
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

// ── Context Breakdown Card ───────────────────────────────────────────
export function ContextCard({ c }: { c: RunContextSnapshot["contextBreakdown"][0] }) {
  const statusIcon = c.present
    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    : c.category === "invisible"
      ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
      : <XCircle className="h-3.5 w-3.5 text-red-400" />;
  const bgClass = c.present
    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
    : c.category === "invisible"
      ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";

  return (
    <div className={cn("border rounded-md p-2 mb-1.5", bgClass)}>
      <div className="flex items-center gap-2 mb-0.5">
        {statusIcon}
        <span className="font-medium text-xs">{c.name}</span>
        {c.size !== null && (
          <Badge variant="outline" className="ml-auto text-[10px]">
            {c.size > 1024 ? (c.size / 1024).toFixed(1) + " KB" : c.size + (c.category === "adapter_prompt" ? " chars" : " B")}
          </Badge>
        )}
      </div>
      {c.notes && <p className="text-[11px] text-zinc-600 dark:text-zinc-400 ml-5">{c.notes}</p>}
    </div>
  );
}

// ── Inline Run Context Panel (for embedding in RunDetail) ────────────
export function RunContextPanel({ agentId, runId }: { agentId: string; runId: string }) {
  const [open, setOpen] = useState(false);

  const { data: snapshot, isLoading, error } = useQuery({
    queryKey: ["run-context", agentId, runId],
    queryFn: async () => {
      const res = await runContextApi.getRunContext(agentId, runId);
      // Handle both wrapped {data: ...} and direct response shapes
      const data = (res as unknown as { data: RunContextSnapshot })?.data ?? res;
      return data as RunContextSnapshot;
    },
    enabled: open, // Only fetch when expanded
    staleTime: 30_000,
  });

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        <Layers className="h-3.5 w-3.5" />
        <span className="font-medium">Run Context</span>
        <span className="text-[10px] ml-1 opacity-60">what the agent actually received</span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <Clock className="h-3.5 w-3.5 animate-spin" /> Loading context...
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 py-2">
              {error instanceof Error ? error.message : "Failed to load run context"}
            </div>
          )}

          {snapshot && (
            <div className="space-y-2 mt-1">
              {/* Context Breakdown */}
              {snapshot.contextBreakdown.length > 0 && (
                <ContextSection
                  title="Context Breakdown"
                  defaultOpen={true}
                  badge={
                    <Badge variant="outline" className="text-[10px]">
                      {snapshot.contextBreakdown.filter((c) => c.present).length}/{snapshot.contextBreakdown.length} present
                    </Badge>
                  }
                >
                  {snapshot.contextBreakdown.map((c, i) => (
                    <ContextCard key={i} c={c} />
                  ))}
                </ContextSection>
              )}

              {/* Adapter Prompt */}
              {snapshot.adapterPrompt && (
                <ContextSection title="Adapter Prompt" badge={
                  <Badge variant="outline" className="text-[10px]">
                    {snapshot.adapterPrompt.length > 1024
                      ? (snapshot.adapterPrompt.length / 1024).toFixed(1) + " KB"
                      : snapshot.adapterPrompt.length + " chars"}
                  </Badge>
                }>
                  <pre className="text-[11px] bg-zinc-900 text-zinc-100 rounded-md p-2 overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                    {snapshot.adapterPrompt}
                  </pre>
                </ContextSection>
              )}

              {/* Effective Toolsets */}
              <ContextSection title="Effective Toolsets">
                {snapshot.effectiveToolsets && snapshot.effectiveToolsets.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {snapshot.effectiveToolsets.map((t, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No explicit toolsets captured. Uses adapter config defaults.</p>
                )}
              </ContextSection>

              {/* Runtime Files */}
              {snapshot.runtimeFiles.length > 0 && (
                <ContextSection title="Runtime Files">
                  {snapshot.runtimeFiles.map((f, i) => (
                    <div key={i} className="mb-1.5 border rounded-md p-2">
                      <div className="flex items-center gap-2 text-xs">
                        {f.exists
                          ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                          : <XCircle className="h-3 w-3 text-red-400" />
                        }
                        <span className="font-mono text-[11px]">{f.path}</span>
                        {f.sizeBytes !== null && (
                          <Badge variant="outline" className="text-[10px] ml-auto">
                            {f.sizeBytes > 1024 ? (f.sizeBytes / 1024).toFixed(1) + " KB" : f.sizeBytes + " B"}
                          </Badge>
                        )}
                      </div>
                      {f.snippet && (
                        <pre className="text-[10px] bg-zinc-900 text-zinc-300 rounded p-1.5 mt-1 overflow-auto max-h-24 whitespace-pre-wrap font-mono">
                          {f.snippet}
                        </pre>
                      )}
                    </div>
                  ))}
                </ContextSection>
              )}

              {/* Blind Spots */}
              {snapshot.contextBreakdown.some((c) => c.category === "invisible") && (
                <ContextSection
                  title="Blind Spots"
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                >
                  {snapshot.contextBreakdown
                    .filter((c) => c.category === "invisible")
                    .map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs mb-1 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>{c.name}</span>
                        {c.notes && <span className="text-[10px] opacity-70">— {c.notes}</span>}
                      </div>
                    ))
                  }
                </ContextSection>
              )}

              {/* Run Events summary */}
              {snapshot.events.length > 0 && (
                <ContextSection
                  title={`Run Events (${snapshot.events.length})`}
                  badge={
                    <Badge variant="outline" className="text-[10px]">
                      {snapshot.events.filter((e) => e.level === "error").length} errors
                    </Badge>
                  }
                >
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {snapshot.events.map((e, i) => (
                      <div key={i} className={cn(
                        "flex gap-1.5 text-[11px] font-mono p-1 rounded",
                        e.eventType === "adapter.invoke" && "bg-blue-50 dark:bg-blue-900/20",
                        e.level === "error" && "bg-red-50 dark:bg-red-900/20",
                      )}>
                        <span className="text-zinc-400 w-6 text-right shrink-0">#{e.seq}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">{e.eventType}</Badge>
                        <span className="truncate text-zinc-600 dark:text-zinc-400">{e.message ?? "—"}</span>
                        <span className="text-zinc-400 ml-auto shrink-0">
                          {new Date(e.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </ContextSection>
              )}

              {/* Inspected timestamp */}
              <p className="text-[10px] text-muted-foreground text-right">
                Context snapshot from {new Date(snapshot.inspectedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
