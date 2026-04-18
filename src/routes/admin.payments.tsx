import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
import type { Database } from "@/integrations/supabase/types";

type Due = Database["public"]["Tables"]["dues"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const Route = createFileRoute("/admin/payments")({
  component: PaymentsSandbox,
});

function PaymentsSandbox() {
  const [dues, setDues] = useState<(Due & { student?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<(Due & { student?: Profile }) | null>(null);
  const [paying, setPaying] = useState(false);

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

  const totals = useMemo(() => {
    const sum = dues.reduce((acc, d) => acc + Number(d.amount), 0);
    return { count: dues.length, sum };
  }, [dues]);

  const pay = async () => {
    if (!active) return;
    setPaying(true);
    try {
      // Mark due as paid
      const { error } = await supabase
        .from("dues")
        .update({ status: "paid" })
        .eq("id", active.id);
      if (error) throw error;

      // Generate receipt PDF
      const pdfBytes = await buildReceipt({
        receiptId: `R-${active.id.slice(0, 8).toUpperCase()}`,
        studentName: active.student?.full_name ?? "—",
        rollNo: active.student?.roll_no ?? "—",
        department: active.student?.department ?? "—",
        dueType: active.due_type,
        amount: Number(active.amount),
        paidAt: new Date(),
      });
      const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${active.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Payment recorded · receipt downloaded");
      setActive(null);
      load();
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
      subtitle="Simulated transactions clear pending dues and unblock the pipeline."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Pending dues" value={totals.count.toString()} />
        <Stat label="Outstanding" value={`₹ ${totals.sum.toFixed(2)}`} />
        <Stat label="Mode" value="Sandbox" />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Pending dues</h3>
        </div>
        {loading ? (
          <div className="px-5 py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : dues.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">All clear · no pending dues.</div>
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
            <DialogTitle>Simulated payment</DialogTitle>
            <DialogDescription>
              This sandbox marks the due as paid and emits a digital receipt PDF.
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

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Card number"
                  defaultValue="4242 4242 4242 4242"
                />
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="MM/YY · CVC"
                  defaultValue="12/29 · 123"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActive(null)} disabled={paying}>
                  Cancel
                </Button>
                <Button onClick={pay} disabled={paying}>
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Pay ₹ {Number(active.amount).toFixed(2)}
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

async function buildReceipt(args: {
  receiptId: string;
  studentName: string;
  rollNo: string;
  department: string;
  dueType: string;
  amount: number;
  paidAt: Date;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 420]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0, 49 / 255, 83 / 255);

  page.drawRectangle({ x: 0, y: 380, width: 595, height: 40, color: blue });
  page.drawText("NEXUS · PAYMENT RECEIPT", {
    x: 30, y: 393, size: 14, font: bold, color: rgb(1, 1, 1),
  });
  page.drawText(args.receiptId, {
    x: 460, y: 393, size: 12, font: bold, color: rgb(1, 1, 1),
  });

  let y = 340;
  const line = (label: string, value: string) => {
    page.drawText(label, { x: 30, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(value, { x: 200, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 24;
  };
  line("Student", args.studentName);
  line("Roll number", args.rollNo);
  line("Department", args.department);
  line("Due type", args.dueType);
  line("Paid at", args.paidAt.toLocaleString());
  line("Amount", `INR ${args.amount.toFixed(2)}`);

  page.drawText("This is a system-generated sandbox receipt. Status: PAID.", {
    x: 30, y: 60, size: 9, font, color: rgb(0.4, 0.4, 0.4),
  });
  return pdf.save();
}
