import { useQuery } from "@tanstack/react-query";
import { runtimeTruthApi } from "../api/runtimeTruth";
import { StatusBadge } from "./RuntimeTruthComponents";
import { DollarSign, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export function BudgetWiringCard() {
  const { data } = useQuery({
    queryKey: ["runtime-truth-budget"],
    queryFn: () => runtimeTruthApi.get(),
    staleTime: 30000,
  });

  if (!data) return null;

  const { budget } = data;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Budget Wiring Status</h3>
        <StatusBadge
          status={budget.configured ? "live" : "missing"}
          label={budget.configured ? "Wired" : "Not Configured"}
        />
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          {budget.configured ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-500" />
          )}
          <span className="text-xs">
            Budget limits: {budget.configured ? "Configured" : "Not configured"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {budget.costEventsTable ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
          <span className="text-xs">
            Cost tracking: {budget.costEventsTable ? "Active (cost_events table exists)" : "No cost events table"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{budget.details}</p>
      </div>
    </div>
  );
}
