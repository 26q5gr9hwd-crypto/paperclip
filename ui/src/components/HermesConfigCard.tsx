import { useQuery } from "@tanstack/react-query";
import { runtimeTruthApi } from "../api/runtimeTruth";
import { StatusBadge } from "./RuntimeTruthComponents";
import { Settings2 } from "lucide-react";

export function HermesConfigCard() {
  const { data } = useQuery({
    queryKey: ["runtime-truth-hermes"],
    queryFn: () => runtimeTruthApi.get(),
    staleTime: 30000,
  });
  if (!data?.hermesConfig) return null;
  const config = data.hermesConfig as Record<string, unknown>;
  const rows: [string, string][] = [
    ["Active Model", String(config.model || "unknown")],
    ["Memory Provider", String(config.memoryProvider || "unknown")],
    ["Config Version", String(config.configVersion || "?")],
  ];
  if (config.gateway) {
    rows.push(["Gateway", String(config.gateway)]);
  }
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Hermes Runtime Config</h3>
        <StatusBadge status="live" label="from disk" />
      </div>
      <div className="px-4 py-3">
        <p className="text-[11px] text-muted-foreground mb-2">
          Read from <code className="text-[10px] bg-muted px-1 py-0.5 rounded">config.yaml</code> — the actual config Hermes uses at runtime.
        </p>
        <div className="space-y-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs font-mono font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
