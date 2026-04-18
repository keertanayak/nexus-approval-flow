import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { primaryRole, type AppRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type Due = Database["public"]["Tables"]["dues"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const Route = createFileRoute("/admin/payments")({
  beforeLoad: async () => {
    // Check if user is authenticated and has admin role
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

    // Only allow admin and principal to access this page
    const adminRoles: AppRole[] = ["admin", "principal"];
    if (!adminRoles.includes(role)) {
      throw redirect({ to: "/student/dashboard" });
    }
  },
  component: PaymentsSandbox,
});

function PaymentsSandbox() {
  const [dues, setDues] = useState<(Due & { student?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<(Due & { student?: Profile }) | null>(null);
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const handledReturnRef = useRef(false);
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  const stripeReady = Boolean(stripeKey && stripeKey.startsWith("pk_test_"));
  const stripeGatewayLabel = !stripeKey ? "Missing key" : stripeReady ? "Stripe test" : "Invalid key";

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

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dues")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const ids = Array.from(new Set((data ?? []).map((d) => d.student_id)));
    let map: Record<string, Profile> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
      map = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    }
    setDues((data ?? []).map((d) => ({ ...d, student: map[d.student_id] })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (handledReturnRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const dueId = params.get("due_id");
    const sessionId = params.get("session_id");

    if (!payment) return;
    handledReturnRef.current = true;

    const clearSearch = () => {
      window.history.replaceState({}, "", "/admin/payments");
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
          const text = await resp.text();
          throw new Error(text || "Could not confirm Stripe payment");
        }

        toast.success("Payment confirmed · due marked as paid");
        await load();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Payment confirmation failed";
        toast.error(msg);
      } finally {
        setConfirming(false);
        clearSearch();
      }
    };

    confirmPayment();
  }, []);

  const totals = useMemo(() => {
    const sum = dues.reduce((acc, d) => acc + Number(d.amount), 0);
    return { count: dues.length, sum };
  }, [dues]);

  const pay = async () => {
    if (!active) return;
    if (!stripeReady) {
      toast.error("Stripe sandbox key is missing or invalid. Expected pk_test_ key.");
      return;
    }

    setPaying(true);
    try {
      const headers = await authHeaders();
      const resp = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({ due_id: active.id }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Failed to create Stripe checkout session");
      }

      const data = (await resp.json()) as { checkout_url?: string };
      if (!data.checkout_url) {
        throw new Error("Missing checkout URL from server");
      }

      setActive(null);
      window.location.href = data.checkout_url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      toast.error(msg);
    } finally {
      setPaying(false);
    }
  };

  return (
    <DashboardShell
      title="Payments sandbox"
      subtitle="Stripe test checkout clears pending dues and unblocks the pipeline."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Pending dues" value={totals.count.toString()} />
        <Stat label="Outstanding" value={`₹ ${totals.sum.toFixed(2)}`} />
        <Stat label="Gateway" value={stripeGatewayLabel} />
      </div>

      {confirming && (
        <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Confirming Stripe payment with server...
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Pending dues</h3>
        </div>
        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : dues.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            All clear · no pending dues.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Roll no</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {dues.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 font-medium">{d.student?.full_name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs">{d.student?.roll_no ?? "—"}</td>
                    <td className="px-5 py-3">{d.due_type}</td>
                    <td className="px-5 py-3 font-mono">₹ {Number(d.amount).toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" onClick={() => setActive(d)}>
                        <CreditCard className="h-3.5 w-3.5" />
                        Pay
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stripe sandbox payment</DialogTitle>
            <DialogDescription>
              You will be redirected to Stripe Checkout test mode. Use test card
              4242 4242 4242 4242.
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <div className="grid grid-cols-2 gap-y-1.5">
                  <span className="text-muted-foreground">Student</span>
                  <span className="font-medium">{active.student?.full_name}</span>
                  <span className="text-muted-foreground">Roll no</span>
                  <span className="font-mono text-xs">{active.student?.roll_no}</span>
                  <span className="text-muted-foreground">Type</span>
                  <span>{active.due_type}</span>
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-mono">₹ {Number(active.amount).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActive(null)} disabled={paying}>
                  Cancel
                </Button>
                <Button onClick={pay} disabled={paying}>
                  {paying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Pay with Stripe · ₹ {Number(active.amount).toFixed(2)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
