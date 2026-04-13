import { useQuery } from "@tanstack/react-query";
import { runtimeTruthApi } from "../api/runtimeTruth";
import { ServiceIcon, StatusBadge, formatTimeAgo } from "./RuntimeTruthComponents";
import { Server, RefreshCw } from "lucide-react";

export function ServiceHealthStrip() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["runtime-truth-services"],
    queryFn: () => runtimeTruthApi.get(),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  if (!data) return null;

  const liveCount = data.services.filter((s) => s.status === "live").length;
  const totalCount = data.services.length;
  const allLive = liveCount === totalCount;

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${allLive ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
      <Server className={`h-4 w-4 shrink-0 ${allLive ? "text-emerald-500" : "text-amber-500"}`} />
      <div className="flex flex-1 items-center gap-3 overflow-x-auto">
        {data.services.map((service) => (
          <div key={service.name} className="flex items-center gap-1.5 shrink-0">
            <ServiceIcon status={service.status} />
            <span className="text-xs font-medium">{service.name}</span>
            <span className="text-[10px] text-muted-foreground">{service.latencyMs}ms</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge
          status={allLive ? "live" : "error"}
          label={`${liveCount}/${totalCount} live`}
        />
        {data.checkedAt && (
          <span className="text-[10px] text-muted-foreground">
            {formatTimeAgo(new Date(data.checkedAt))}
          </span>
        )}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
