import {
  Clock3,
  Cloud,
  GitBranch,
  GitCommitHorizontal,
  Server,
  type LucideIcon,
} from "lucide-react";
import { rawajBuildInfo } from "@/lib/build-info";
import { useUiPreferences } from "@/lib/ui-preferences";

export function DeploymentTruthPanel() {
  const { language, text } = useUiPreferences();
  const isProduction =
    rawajBuildInfo.environment === "production" || rawajBuildInfo.target === "production";
  const commit =
    rawajBuildInfo.commitSha === "unknown"
      ? text("غير متاح", "Unavailable")
      : rawajBuildInfo.commitSha;
  const branch =
    rawajBuildInfo.branch === "unknown" ? text("غير متاح", "Unavailable") : rawajBuildInfo.branch;
  const deploymentUrl = rawajBuildInfo.deploymentUrl || text("غير متاح", "Unavailable");

  return (
    <section className="rounded-2xl bg-card p-5 hairline shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Cloud className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground">
              {text("حقيقة النسخة المنشورة", "Deployment truth")}
            </p>
            <h3 className="mt-1 text-base font-extrabold">
              {text("هوية البناء الحالي", "Current build identity")}
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-6 text-muted-foreground">
              {text(
                "هذه القيم مضمّنة وقت البناء، وتكشف بدقة أي Commit وبيئة وفرع تخدم الصفحة الحالية.",
                "These values are embedded at build time and identify the exact commit, environment, and branch serving this page.",
              )}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold ${
            isProduction ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          }`}
        >
          {isProduction
            ? text("نسخة Production", "Production build")
            : text("ليست Production", "Not production")}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DeploymentFact
          icon={GitCommitHorizontal}
          label={text("Commit", "Commit")}
          value={commit}
          mono
        />
        <DeploymentFact
          icon={GitBranch}
          label={text("الفرع", "Branch")}
          value={branch}
          mono
        />
        <DeploymentFact
          icon={Server}
          label={text("البيئة / الهدف", "Environment / target")}
          value={`${rawajBuildInfo.environment} / ${rawajBuildInfo.target}`}
          mono
        />
        <DeploymentFact
          icon={Clock3}
          label={text("وقت البناء", "Built at")}
          value={formatBuildTime(rawajBuildInfo.builtAt, language)}
        />
        <DeploymentFact
          icon={Cloud}
          label={text("المزوّد", "Provider")}
          value={rawajBuildInfo.provider}
          mono
        />
        <DeploymentFact
          icon={Cloud}
          label={text("عنوان النشر", "Deployment host")}
          value={deploymentUrl}
          mono
        />
      </div>
    </section>
  );
}

function DeploymentFact({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-muted-surface/60 p-3 hairline">
      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div
        dir={mono ? "ltr" : undefined}
        className={`mt-2 break-all text-xs font-extrabold ${mono ? "font-mono text-left" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function formatBuildTime(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}
