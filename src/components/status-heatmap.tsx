import { Check, Clock, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StageState = "cleared" | "pending" | "rejected" | "blocked" | "idle";

export interface HeatmapStage {
  key: string;
  label: string;
  state: StageState;
}

const STATE_STYLES: Record<StageState, string> = {
  cleared: "bg-success/15 text-success ring-success/40",
  pending: "bg-warning/15 text-warning ring-warning/40",
  rejected: "bg-destructive/15 text-destructive ring-destructive/40",
  blocked: "bg-destructive/15 text-destructive ring-destructive/40",
  idle: "bg-muted text-muted-foreground ring-border",
};

const STATE_LABEL: Record<StageState, string> = {
  cleared: "Cleared",
  pending: "Pending",
  rejected: "Rejected",
  blocked: "Blocked",
  idle: "Not started",
};

function StateIcon({ state }: { state: StageState }) {
  switch (state) {
    case "cleared":
      return <Check className="h-4 w-4" />;
    case "pending":
      return <Clock className="h-4 w-4" />;
    case "rejected":
      return <X className="h-4 w-4" />;
    case "blocked":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

export function StatusHeatmap({ stages }: { stages: HeatmapStage[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Live status heatmap</h3>
          <p className="text-xs text-muted-foreground">
            Color-coded sequential pipeline · refreshes every 5s
          </p>
        </div>
        <div className="hidden items-center gap-3 text-[11px] sm:flex">
          <Legend color="bg-success" label="Cleared" />
          <Legend color="bg-warning" label="Pending" />
          <Legend color="bg-destructive" label="Blocked" />
        </div>
      </div>

      <ol className="relative grid gap-3 sm:grid-cols-4">
        <div className="absolute left-4 right-4 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent sm:block" />
        {stages.map((s, i) => (
          <li
            key={s.key}
            className={cn(
              "relative rounded-xl border bg-background/60 p-4 text-center backdrop-blur",
              s.state === "cleared" && "border-success/30",
              s.state === "pending" && "border-warning/30",
              (s.state === "rejected" || s.state === "blocked") && "border-destructive/30",
              s.state === "idle" && "border-border",
            )}
          >
            <div
              className={cn(
                "mx-auto flex h-10 w-10 items-center justify-center rounded-full ring-1",
                STATE_STYLES[s.state],
              )}
            >
              <StateIcon state={s.state} />
            </div>
            <div className="mt-3 text-sm font-semibold text-foreground">{s.label}</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              {STATE_LABEL[s.state]}
            </div>
            <div className="absolute -top-2 left-3 rounded-full bg-card px-1.5 text-[10px] font-mono text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </div>
  );
}
