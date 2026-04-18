import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import Papa from "papaparse";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type Due = Database["public"]["Tables"]["dues"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Row {
  roll_no: string;
  student_name?: string;
  department?: string;
  due_type: string;
  amount: string | number;
}

export const Route = createFileRoute("/admin/dues")({
  component: AdminDues,
});

function AdminDues() {
  const [importing, setImporting] = useState(false);
  const [dues, setDues] = useState<(Due & { student?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: dRows } = await supabase
      .from("dues")
      .select("*")
      .order("created_at", { ascending: false });
    const ids = Array.from(new Set((dRows ?? []).map((d) => d.student_id)));
    let map: Record<string, Profile> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
      map = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    }
    setDues((dRows ?? []).map((d) => ({ ...d, student: map[d.student_id] })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const importCsv = (file: File) => {
    setImporting(true);
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          const rows = result.data.filter((r) => r.roll_no && r.due_type && r.amount);
          if (rows.length === 0) {
            toast.error("CSV looks empty or missing required columns");
            return;
          }

          // Find profiles by roll_no
          const rolls = Array.from(new Set(rows.map((r) => r.roll_no.trim())));
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, roll_no")
            .in("roll_no", rolls);
          const byRoll = Object.fromEntries((profs ?? []).map((p) => [p.roll_no, p.id]));

          const inserts = rows
            .map((r) => {
              const sid = byRoll[r.roll_no.trim()];
              if (!sid) return null;
              return {
                student_id: sid,
                due_type: r.due_type,
                amount: Number(r.amount) || 0,
              };
            })
            .filter(Boolean) as { student_id: string; due_type: string; amount: number }[];

          if (inserts.length === 0) {
            toast.error("No matching students found for these roll numbers");
            return;
          }

          const { error } = await supabase.from("dues").insert(inserts);
          if (error) throw error;

          toast.success(`Imported ${inserts.length} dues (${rows.length - inserts.length} skipped)`);
          load();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Import failed";
          toast.error(msg);
        } finally {
          setImporting(false);
        }
      },
      error: (err) => {
        toast.error(err.message);
        setImporting(false);
      },
    });
  };

  return (
    <DashboardShell
      title="Dues management"
      subtitle="Bulk-flag students with pending dues. Clearance is blocked until paid."
    >
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Flat-file CSV import</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Required columns: <span className="font-mono">roll_no, student_name, department, due_type, amount</span>
            </p>
          </div>
          <label>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
              }}
            />
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload CSV
            </span>
          </label>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">All dues</h3>
          <p className="text-xs text-muted-foreground">{dues.length} total</p>
        </div>
        {loading ? (
          <div className="px-5 py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : dues.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">No dues recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Roll no</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {dues.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 font-medium">{d.student?.full_name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs">{d.student?.roll_no ?? "—"}</td>
                    <td className="px-5 py-3">{d.due_type}</td>
                    <td className="px-5 py-3 font-mono">₹ {Number(d.amount).toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                          d.status === "paid"
                            ? "bg-success/15 text-success ring-success/30"
                            : "bg-destructive/15 text-destructive ring-destructive/30"
                        }`}
                      >
                        {d.status === "paid" ? "Paid" : "Pending"}
                      </span>
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
