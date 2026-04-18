import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, FileText, Flag, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth, primaryRole, type AppRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nextStage, statusForApprovedStage, stageLabel } from "@/lib/clearance";
import type { Database } from "@/integrations/supabase/types";

type Application = Database["public"]["Tables"]["applications"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Document = Database["public"]["Tables"]["documents"]["Row"];
type Approval = Database["public"]["Tables"]["approvals"]["Row"];
type ApplicationStage = Database["public"]["Enums"]["application_stage"];

export const Route = createFileRoute("/approver/dashboard")({
  component: ApproverDashboard,
});

function approverStage(role: AppRole): ApplicationStage | null {
  if (role === "lab_incharge") return "lab_incharge";
  if (role === "hod") return "hod";
  if (role === "principal") return "principal";
  return null;
}

function ApproverDashboard() {
  const { roles, user } = useAuth();
  const role = primaryRole(roles);
  const myStage = approverStage(role);

  const [apps, setApps] = useState<(Application & { student?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Application | null>(null);

  const load = async () => {
    if (!myStage) return;
    setLoading(true);
    const { data: appRows } = await supabase
      .from("applications")
      .select("*")
      .eq("current_stage", myStage)
      .neq("status", "rejected")
      .order("submission_date", { ascending: true });
    const studentIds = Array.from(new Set((appRows ?? []).map((a) => a.student_id)));
    let profilesById: Record<string, Profile> = {};
    if (studentIds.length) {
      const { data: profRows } = await supabase
        .from("profiles")
        .select("*")
        .in("id", studentIds);
      profilesById = Object.fromEntries((profRows ?? []).map((p) => [p.id, p]));
    }
    setApps(
      (appRows ?? []).map((a) => ({ ...a, student: profilesById[a.student_id] })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStage]);

  if (!myStage) {
    return (
      <DashboardShell title="Approver dashboard" subtitle="Your account has no approval stage assigned.">
        <p className="text-sm text-muted-foreground">Contact an admin to assign your role.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={`${stageLabel(myStage)} action queue`}
      subtitle="Sequential, real-time. Click a row to inspect documents and act."
    >
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Pending applications</h3>
            <p className="text-xs text-muted-foreground">{apps.length} awaiting your action</p>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {apps.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No applications waiting for {stageLabel(myStage)} action.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Roll no</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 font-medium">{a.student?.full_name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs">{a.student?.roll_no ?? "—"}</td>
                    <td className="px-5 py-3">{a.student?.department ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(a.submission_date).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setActive(a)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReviewDialog
        application={active}
        onClose={() => setActive(null)}
        onActed={() => {
          setActive(null);
          load();
        }}
        approverUserId={user?.id ?? ""}
        approverStage={myStage}
      />
    </DashboardShell>
  );
}

function ReviewDialog({
  application,
  onClose,
  onActed,
  approverUserId,
  approverStage,
}: {
  application: Application | null;
  onClose: () => void;
  onActed: () => void;
  approverUserId: string;
  approverStage: ApplicationStage;
}) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [history, setHistory] = useState<Approval[]>([]);
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState<"approve" | "flag" | "reject" | null>(null);

  useEffect(() => {
    if (!application) return;
    setComment("");
    (async () => {
      const [docRes, apvRes] = await Promise.all([
        supabase.from("documents").select("*").eq("application_id", application.id),
        supabase
          .from("approvals")
          .select("*")
          .eq("application_id", application.id)
          .order("created_at", { ascending: true }),
      ]);
      const docList = docRes.data ?? [];
      setDocs(docList);
      setHistory(apvRes.data ?? []);
      const urls: Record<string, string> = {};
      for (const d of docList) {
        const { data } = await supabase.storage
          .from("nexus-documents")
          .createSignedUrl(d.file_url, 60 * 10);
        if (data?.signedUrl) urls[d.id] = data.signedUrl;
      }
      setSignedUrls(urls);
      setActiveDoc(docList[0]?.id ?? null);
    })();
  }, [application?.id]);

  const submitAction = async (action: "approve" | "flag" | "reject") => {
    if (!application) return;
    if (action !== "approve" && comment.trim().length < 4) {
      toast.error("Please provide a comment for flag/reject.");
      return;
    }
    if (action === "approve" && comment.trim().length === 0) {
      // optional comment for approve
    }
    setActing(action);
    try {
      // 1. Insert approval row
      const { error: apvErr } = await supabase.from("approvals").insert({
        application_id: application.id,
        approver_id: approverUserId,
        stage: approverStage,
        action,
        comment: comment.trim() || null,
      });
      if (apvErr) throw apvErr;

      // 2. Update application
      const chain = Array.isArray(application.chain_of_custody)
        ? [...(application.chain_of_custody as unknown[])]
        : [];
      chain.push({
        event: action,
        stage: approverStage,
        by: approverUserId,
        at: new Date().toISOString(),
        comment: comment.trim() || null,
      });

      let patch: Partial<Application> = {
        chain_of_custody: chain as Application["chain_of_custody"],
      };
      if (action === "approve") {
        patch = {
          ...patch,
          status: statusForApprovedStage(approverStage),
          current_stage: nextStage(approverStage),
        };
      } else if (action === "reject") {
        patch = {
          ...patch,
          status: "rejected",
          rejection_reason: comment.trim(),
        };
      }
      const { error: updErr } = await supabase
        .from("applications")
        .update(patch)
        .eq("id", application.id);
      if (updErr) throw updErr;

      // 3. If principal approved — generate certificate
      if (action === "approve" && approverStage === "principal") {
        try {
          const resp = await fetch("/api/generate-certificate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ application_id: application.id }),
          });
          if (!resp.ok) {
            const text = await resp.text();
            console.warn("Certificate generation failed:", text);
            toast.warning("Approved, but certificate generation failed");
          } else {
            toast.success("Approved · certificate generated");
          }
        } catch (e) {
          console.warn(e);
        }
      } else {
        toast.success(`Application ${action}d`);
      }

      onActed();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      toast.error(msg);
    } finally {
      setActing(null);
    }
  };

  const activeDocRow = useMemo(() => docs.find((d) => d.id === activeDoc), [docs, activeDoc]);

  return (
    <Dialog open={!!application} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Review application</DialogTitle>
          <DialogDescription>
            Side-by-side document preview · digital chain of custody updates in real time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* Preview */}
          <div className="rounded-xl border border-border bg-muted/40">
            <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setActiveDoc(d.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeDoc === d.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  <span className="max-w-[12rem] truncate">{d.file_name}</span>
                </button>
              ))}
              {docs.length === 0 && (
                <span className="text-xs text-muted-foreground">No documents.</span>
              )}
            </div>
            <div className="aspect-[4/3] w-full bg-background">
              {activeDocRow && signedUrls[activeDocRow.id] ? (
                activeDocRow.file_type.startsWith("image/") ? (
                  <img
                    src={signedUrls[activeDocRow.id]}
                    alt={activeDocRow.file_name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <iframe
                    src={signedUrls[activeDocRow.id]}
                    title={activeDocRow.file_name}
                    className="h-full w-full"
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading preview…
                </div>
              )}
            </div>
          </div>

          {/* Action panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="text-sm font-semibold">Chain of custody</h4>
              <ol className="mt-3 space-y-2.5 text-xs">
                {history.length === 0 && (
                  <li className="text-muted-foreground">No approval actions yet.</li>
                )}
                {history.map((h) => (
                  <li key={h.id} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ${
                        h.action === "approve"
                          ? "bg-success/15 text-success ring-success/30"
                          : h.action === "reject"
                            ? "bg-destructive/15 text-destructive ring-destructive/30"
                            : "bg-warning/15 text-warning ring-warning/30"
                      }`}
                    >
                      {h.action === "approve" ? (
                        <Check className="h-3 w-3" />
                      ) : h.action === "reject" ? (
                        <X className="h-3 w-3" />
                      ) : (
                        <Flag className="h-3 w-3" />
                      )}
                    </span>
                    <div>
                      <div className="font-medium">
                        {stageLabel(h.stage)} · {h.action}
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(h.created_at).toLocaleString()}
                      </div>
                      {h.comment && (
                        <div className="mt-0.5 italic text-muted-foreground">"{h.comment}"</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <label htmlFor="comment" className="text-xs font-semibold">
                Comment <span className="text-muted-foreground">(required for flag/reject)</span>
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Add a brief note about your decision…"
                className="mt-2 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-warning/40 text-warning hover:bg-warning/10"
                  onClick={() => submitAction("flag")}
                  disabled={!!acting}
                >
                  {acting === "flag" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                  Flag
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => submitAction("reject")}
                  disabled={!!acting}
                >
                  {acting === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => submitAction("approve")}
                  disabled={!!acting}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  {acting === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Approve
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
