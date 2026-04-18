/**
 * Pure helpers for clearance state derivation.
 * Pipeline order: lab_incharge → hod → principal → dues
 */

import type { Database } from "@/integrations/supabase/types";
import type { StageState, HeatmapStage } from "@/components/status-heatmap";

type ApplicationStage = Database["public"]["Enums"]["application_stage"];
type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type DueStatus = Database["public"]["Enums"]["due_status"];

export const STAGE_ORDER: ApplicationStage[] = ["lab_incharge", "hod", "principal", "completed"];

export function deriveHeatmap(args: {
  status: ApplicationStatus | null;
  currentStage: ApplicationStage | null;
  hasPendingDues: boolean;
}): HeatmapStage[] {
  const { status, currentStage, hasPendingDues } = args;
  const isRejected = status === "rejected";

  const stageState = (stage: ApplicationStage): StageState => {
    if (!status || !currentStage) return "idle";
    if (isRejected && stage === currentStage) return "rejected";
    const idx = STAGE_ORDER.indexOf(stage);
    const cur = STAGE_ORDER.indexOf(currentStage);
    if (currentStage === "completed") return "cleared";
    if (idx < cur) return "cleared";
    if (idx === cur) return "pending";
    return "idle";
  };

  const duesState: StageState = hasPendingDues
    ? "blocked"
    : status === "principal_approved" || currentStage === "completed"
      ? "cleared"
      : "pending";

  return [
    { key: "lab", label: "Lab in-charge", state: stageState("lab_incharge") },
    { key: "hod", label: "HOD review", state: stageState("hod") },
    { key: "principal", label: "Principal", state: stageState("principal") },
    { key: "dues", label: "Dues", state: duesState },
  ];
}

export function nextStage(stage: ApplicationStage): ApplicationStage {
  const idx = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)];
}

export function statusForApprovedStage(stage: ApplicationStage): ApplicationStatus {
  switch (stage) {
    case "lab_incharge": return "lab_cleared";
    case "hod": return "hod_cleared";
    case "principal": return "principal_approved";
    case "completed": return "principal_approved";
  }
}

export function stageLabel(stage: ApplicationStage): string {
  switch (stage) {
    case "lab_incharge": return "Lab in-charge";
    case "hod": return "HOD";
    case "principal": return "Principal";
    case "completed": return "Completed";
  }
}
