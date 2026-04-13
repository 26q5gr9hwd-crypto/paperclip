import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  Wrench,
} from "lucide-react";

export function FreshnessIcon({ freshness }: { freshness: string }) {
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

export function ServiceIcon({ status }: { status: string }) {
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

export function StatusBadge({ status, label }: { status: string; label: string }) {
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

export function formatTimeAgo(date: Date): string {
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

export function SkillStatusIcon({ hasSkillMd }: { hasSkillMd: boolean }) {
  if (hasSkillMd) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <Eye className="h-3 w-3" /> SKILL.md
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <EyeOff className="h-3 w-3" /> No SKILL.md
    </span>
  );
}

export { Wrench };
