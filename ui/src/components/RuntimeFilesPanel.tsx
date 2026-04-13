import { useQuery } from "@tanstack/react-query";
import { runtimeTruthApi, type FileStatus } from "../api/runtimeTruth";
import { FreshnessIcon, StatusBadge, formatTimeAgo } from "./RuntimeTruthComponents";
import { FileText, ChevronRight } from "lucide-react";

function FileRow({ file }: { file: FileStatus }) {
  const fileName = file.path.split("/").pop() || file.path;
  const timeAgo = file.modifiedAt ? formatTimeAgo(new Date(file.modifiedAt)) : null;
  return (
    <details className="group">
      <summary className="flex cursor-pointer items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50">
        <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform group-open:rotate-90 shrink-0" />
        <FreshnessIcon freshness={file.freshness} />
        <span className="font-mono text-xs font-medium flex-1 min-w-0 truncate">{fileName}</span>
        <StatusBadge status={file.freshness} label={file.freshness} />
        {file.exists && file.sizeBytes != null && (
          <span className="text-[10px] text-muted-foreground shrink-0">{file.sizeBytes}B</span>
        )}
        {timeAgo && (
          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
        )}
      </summary>
      {file.exists && file.content && (
        <div className="ml-9 mt-1 mb-2">
          <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] font-mono text-muted-foreground bg-muted/30 rounded-md p-2.5 max-h-48 overflow-y-auto">
            {file.content}
          </pre>
        </div>
      )}
    </details>
  );
}

export function RuntimeFilesPanel() {
  const { data } = useQuery({
    queryKey: ["runtime-truth-files"],
    queryFn: () => runtimeTruthApi.get(),
    staleTime: 30000,
  });
  if (!data) return null;
  const liveCount = data.systemFiles.filter((f) => f.freshness === "live").length;
  const staleCount = data.systemFiles.filter((f) => f.freshness === "stale").length;
  const missingCount = data.systemFiles.filter((f) => f.freshness === "missing").length;
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Runtime Files</h3>
        <div className="flex items-center gap-1.5 ml-auto">
          {liveCount > 0 && <StatusBadge status="live" label={`${liveCount} live`} />}
          {staleCount > 0 && <StatusBadge status="stale" label={`${staleCount} stale`} />}
          {missingCount > 0 && <StatusBadge status="missing" label={`${missingCount} missing`} />}
        </div>
      </div>
      <div className="py-1">
        {data.systemFiles.map((file) => (
          <FileRow key={file.path} file={file} />
        ))}
      </div>
    </div>
  );
}
