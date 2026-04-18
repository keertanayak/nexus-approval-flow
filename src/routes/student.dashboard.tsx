import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CreditCard, Download, FileUp, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { useAuth, dashboardPathForRole, primaryRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatusHeatmap } from "@/components/status-heatmap";
import { Button } from "@/components/ui/button";
import { deriveHeatmap, stageLabel } from "@/lib/clearance";
import type { Database } from "@/integrations/supabase/types";

type Application = Database["public"]["Tables"]["applications"]["Row"];
type Document = Database["public"]["Tables"]["documents"]["Row"];
type Due = Database["public"]["Tables"]["dues"]["Row"];

export const Route = createFileRoute("/student/dashboard")({
  beforeLoad: async () => {
    // Check if user is authenticated and has student role
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/sign-in" });
    }

    // Fetch user roles
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const roles = ((rolesData ?? []) as { role: any }[]).map((r) => r.role);
    const role = primaryRole(roles);

    // Only allow students to access this page
    if (role !== "student") {
      throw redirect({ to: dashboardPathForRole(role) });
    }
  },
  component: StudentDashboard,
});

function StudentDashboard() {
  const { profile } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [zipping, setZipping] = useState(false);
  const [payingDueId, setPayingDueId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  const stripeReady = Boolean(stripeKey && stripeKey.startsWith("pk_test_"));

  const authHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session expired. Please sign in again.");
    }

    return {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    };
  };

  const loadAll = async () => {
    if (!profile) return;
    const [appsRes, duesRes] = await Promise.all([
      supabase
        .from("applications")
        .select("*")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase.from("dues").select("*").eq("student_id", profile.id),
    ]);
    setApps(appsRes.data ?? []);
    setDues(duesRes.data ?? []);

    const ids = (appsRes.data ?? []).map((a) => a.id);
    if (ids.length) {
      const { data: docRows } = await supabase
        .from("documents")
        .select("*")
        .in("application_id", ids);
      setDocs(docRows ?? []);
    } else {
      setDocs([]);
    }
  };

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 5000); // live refresh
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const latest = apps[0];
  const pendingDues = useMemo(() => dues.filter((d) => d.status === "pending"), [dues]);

  const heatmap = useMemo(
    () =>
      deriveHeatmap({
        status: latest?.status ?? null,
        currentStage: latest?.current_stage ?? null,
        hasPendingDues: pendingDues.length > 0,
      }),
    [latest, pendingDues],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const dueId = params.get("due_id");
    const sessionId = params.get("session_id");

    if (!payment) return;

    const clearSearch = () => {
      window.history.replaceState({}, "", "/student/dashboard");
    };

    if (payment === "cancelled") {
      toast.info("Payment was cancelled");
      clearSearch();
      return;
    }

    if (payment !== "success" || !dueId || !sessionId) {
      toast.error("Invalid payment return state");
      clearSearch();
      return;
    }

    const confirmPayment = async () => {
      setConfirming(true);
      try {
        const headers = await authHeaders();
        const resp = await fetch("/api/stripe/confirm-payment", {
          method: "POST",
          headers,
          body: JSON.stringify({ due_id: dueId, session_id: sessionId }),
        });

        if (!resp.ok) {
          const body = (await resp.json().catch(() => null)) as { error?: string } | null;
          if (resp.status === 401) {
            console.error("Unauthorized error during payment confirmation", body);
          }
          throw new Error(body?.error ?? "Could not confirm Stripe payment");
        }

        toast.success("Payment confirmed. Clearance block updated.");
        await loadAll();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Payment confirmation failed";
        toast.error(msg);
      } finally {
        setConfirming(false);
        clearSearch();
      }
    };

    confirmPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payDue = async (dueId: string) => {
    if (!stripeReady) {
      toast.error("Stripe sandbox key is missing or invalid. Expected pk_test_ key.");
      return;
    }

    setPayingDueId(dueId);
    try {
      const headers = await authHeaders();
      const resp = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({ due_id: dueId }),
      });

      if (!resp.ok) {
        const body = (await resp.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create Stripe checkout session");
      }

      const data = (await resp.json()) as { checkout_url?: string };
      if (!data.checkout_url) {
        throw new Error("Missing checkout URL from server");
      }

      window.location.href = data.checkout_url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      toast.error(msg);
      setPayingDueId(null);
    }
  };

  const downloadZip = async () => {
    if (!profile) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("nexus-locker")!;

      // Profile json
      folder.file(
        "profile.json",
        JSON.stringify(
          {
            name: profile.full_name,
            roll_no: profile.roll_no,
            department: profile.department,
            applications: apps.map((a) => ({
              id: a.id,
              status: a.status,
              current_stage: a.current_stage,
              submitted_at: a.submission_date,
            })),
          },
          null,
          2,
        ),
      );

      // Documents
      for (const d of docs) {
        try {
          const path = d.file_url; // stored as bucket path
          const { data, error } = await supabase.storage.from("nexus-documents").download(path);
          if (error || !data) continue;
          const buf = await data.arrayBuffer();
          folder.file(`documents/${d.file_name}`, buf);
        } catch (e) {
          // skip individual file failures
        }
      }

      // Certificates
      for (const a of apps) {
        const { data: cert } = await supabase
          .from("certificates")
          .select("*")
          .eq("application_id", a.id)
          .maybeSingle();
        if (cert?.certificate_url) {
          try {
            const resp = await fetch(cert.certificate_url);
            if (resp.ok) {
              const buf = await resp.arrayBuffer();
              folder.file(`certificates/certificate-${a.id}.pdf`, buf);
            }
          } catch {
            // ignore
          }
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nexus-locker-${profile.roll_no ?? profile.full_name}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Digital locker downloaded");
    } catch (e) {
      toast.error("Could not build ZIP");
    } finally {
      setZipping(false);
    }
  };

  return (
    <DashboardShell
      title={`Welcome, ${profile?.full_name ?? ""}`}
      subtitle={
        profile?.roll_no
          ? `Roll · ${profile.roll_no}  ·  ${profile.department}`
          : profile?.department
      }
    >
      {/* Welcome / quick actions */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            My clearance
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {latest
                  ? latest.status === "principal_approved"
                    ? "Cleared"
                    : latest.status === "rejected"
                      ? "Rejected"
                      : `In review · ${stageLabel(latest.current_stage)}`
                  : "No active application"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {pendingDues.length > 0
                  ? `${pendingDues.length} pending due${pendingDues.length === 1 ? "" : "s"} · clearance is blocked.`
                  : "Submit your documents to start the chain."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg" disabled={!!latest}>
                <Link to="/student/submit">
                  <FileUp className="h-4 w-4" />
                  Submit application
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={downloadZip}
                disabled={zipping || apps.length === 0}
              >
                {zipping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Digital locker ZIP
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="mt-6">
        <StatusHeatmap stages={heatmap} />
      </div>

      {/* Pending dues */}
      {pendingDues.length > 0 && (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <h3 className="text-sm font-semibold text-destructive">
            Pending dues blocking clearance
          </h3>
          {confirming && (
            <p className="mt-2 text-xs text-muted-foreground">
              Verifying Stripe payment and updating due status...
            </p>
          )}
          {!stripeReady && (
            <p className="mt-2 text-xs text-destructive">
              Stripe sandbox is not configured correctly. Expected a publishable key starting with
              {" "}
              <span className="font-mono">pk_test_</span>.
            </p>
          )}
          <ul className="mt-3 divide-y divide-destructive/10 text-sm">
            {pendingDues.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-foreground">{d.due_type}</p>
                  <p className="font-mono text-foreground">₹ {Number(d.amount).toFixed(2)}</p>
                </div>
                <Button
                  size="sm"
                  disabled={!stripeReady || confirming || payingDueId === d.id}
                  onClick={() => payDue(d.id)}
                >
                  {payingDueId === d.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Pay now
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* My applications */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-base font-semibold">My applications</h3>
        {apps.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            You haven't submitted an application yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Submitted</th>
                  <th className="py-2 pr-3">Stage</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">ID</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3">{new Date(a.submission_date).toLocaleString()}</td>
                    <td className="py-2.5 pr-3">{stageLabel(a.current_stage)}</td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                      {a.id.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: Application["status"] }) {
  const map: Record<Application["status"], { className: string; label: string }> = {
    submitted: { className: "bg-warning/15 text-warning ring-warning/30", label: "Submitted" },
    lab_cleared: { className: "bg-warning/15 text-warning ring-warning/30", label: "Lab cleared" },
    hod_cleared: { className: "bg-warning/15 text-warning ring-warning/30", label: "HOD cleared" },
    principal_approved: {
      className: "bg-success/15 text-success ring-success/30",
      label: "Approved",
    },
    rejected: {
      className: "bg-destructive/15 text-destructive ring-destructive/30",
      label: "Rejected",
    },
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${m.className}`}
    >
      {m.label}
    </span>
  );
}
