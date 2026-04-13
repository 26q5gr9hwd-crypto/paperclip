import { useQuery } from "@tanstack/react-query";
import { runtimeTruthApi, type SkillInfo } from "../api/runtimeTruth";
import { StatusBadge } from "./RuntimeTruthComponents";
import { HardDrive, CheckCircle2, XCircle } from "lucide-react";

function SkillChip({ skill }: { skill: SkillInfo }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-mono ${skill.hasSkillMd ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : "border-border bg-muted/30 text-muted-foreground"}`}>
      {skill.hasSkillMd ? (
        <CheckCircle2 className="h-2.5 w-2.5" />
      ) : (
        <XCircle className="h-2.5 w-2.5" />
      )}
      {skill.name}
    </span>
  );
}

export function SkillVpsOverview() {
  const { data } = useQuery({
    queryKey: ["runtime-truth-skills"],
    queryFn: () => runtimeTruthApi.get(),
    staleTime: 30000,
  });
  if (!data) return null;
  const allSkills = [
    ...data.skills.hermes.skills.map((s) => ({ ...s, source: "hermes" as const })),
    ...data.skills.deerflow.skills.map((s) => ({ ...s, source: "deerflow" as const })),
  ];
  const withSkillMd = allSkills.filter((s) => s.hasSkillMd).length;
  const withoutSkillMd = allSkills.length - withSkillMd;
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">VPS Skill Status</h3>
        <StatusBadge status="live" label={`${allSkills.length} on disk`} />
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs">{withSkillMd} with SKILL.md</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs">{withoutSkillMd} without SKILL.md</span>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Hermes ({data.skills.hermes.skills.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {data.skills.hermes.skills.map((skill) => (
              <SkillChip key={skill.path} skill={skill} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">DeerFlow ({data.skills.deerflow.skills.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {data.skills.deerflow.skills.map((skill) => (
              <SkillChip key={skill.path} skill={skill} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
