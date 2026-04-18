import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/submit")({
  component: SubmitPage,
});

const ALLOWED = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;

interface DocSlot {
  key: string;
  label: string;
  description: string;
  file?: File;
  error?: string;
}

const SLOTS: Omit<DocSlot, "file" | "error">[] = [
  { key: "id_card", label: "Student ID Card", description: "Scan or photo (PDF/JPG/PNG, ≤5MB)" },
  { key: "library_receipt", label: "Library Receipt", description: "Latest no-dues receipt" },
  { key: "lab_manual", label: "Lab Manual Return", description: "Lab return acknowledgement" },
];

function SubmitPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<DocSlot[]>(SLOTS.map((s) => ({ ...s })));
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const validate = (file: File): string | undefined => {
    if (!ALLOWED.includes(file.type)) return "Only PDF, JPG or PNG allowed.";
    if (file.size > MAX_BYTES) return "Max 5MB per file.";
    return undefined;
  };

  const onPick = (key: string, file: File) => {
    const error = validate(file);
    setSlots((prev) =>
      prev.map((s) => (s.key === key ? { ...s, file: error ? undefined : file, error } : s)),
    );
  };

  const onClear = (key: string) => {
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, file: undefined, error: undefined } : s)));
  };

  const allReady = slots.every((s) => s.file && !s.error);

  const submit = async () => {
    if (!profile) {
      toast.error("Profile not loaded yet");
      return;
    }
    if (!allReady) {
      toast.error("Please attach all required documents");
      return;
    }
    setSubmitting(true);
    setProgress(5);
    try {
      // Enforce one application per student (active, non-rejected)
      const { data: existing } = await supabase
        .from("applications")
        .select("id,status")
        .eq("student_id", profile.id)
        .neq("status", "rejected");
      if (existing && existing.length > 0) {
        toast.error("You already have an active application.");
        setSubmitting(false);
        return;
      }

      // Create the application first (chain of custody seeds with submission)
      const { data: appRow, error: appErr } = await supabase
        .from("applications")
        .insert({
          student_id: profile.id,
          chain_of_custody: [
            {
              event: "submitted",
              by: profile.full_name,
              at: new Date().toISOString(),
            },
          ],
        })
        .select()
        .single();
      if (appErr || !appRow) throw appErr ?? new Error("Could not create application");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const total = slots.length;
      let done = 0;
      for (const s of slots) {
        const file = s.file!;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${appRow.id}/${s.key}-${Date.now()}-${safeName}`;
        const up = await supabase.storage
          .from("nexus-documents")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;

        const { error: docErr } = await supabase.from("documents").insert({
          application_id: appRow.id,
          uploaded_by: user.id,
          file_name: `${s.label} - ${file.name}`,
          file_url: path, // store bucket path; signed URL on read
          file_type: file.type,
        });
        if (docErr) throw docErr;

        done += 1;
        setProgress(Math.round(10 + (done / total) * 85));
      }

      setProgress(100);
      toast.success("Application submitted — routed to Lab in-charge");
      navigate({ to: "/student/dashboard" });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Submission failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell
      title="Submit clearance application"
      subtitle="Smart Document Vault · validated upload to secure storage"
    >
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          {slots.map((s) => (
            <div
              key={s.key}
              className={cn(
                "relative rounded-xl border bg-background p-4",
                s.error ? "border-destructive/40" : s.file ? "border-success/40" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{s.label}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                </div>
                {s.file ? (
                  <button
                    onClick={() => onClear(s.key)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <label className="mt-4 block">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPick(s.key, f);
                  }}
                />
                <span
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-xs font-medium transition-colors",
                    s.file
                      ? "border-success/40 bg-success/5 text-success"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {s.file ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="max-w-[10rem] truncate">{s.file.name}</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="h-4 w-4" />
                      Choose file
                    </>
                  )}
                </span>
              </label>

              {s.error ? (
                <p className="mt-2 text-xs font-medium text-destructive">{s.error}</p>
              ) : s.file ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {(s.file.size / 1024).toFixed(0)} KB · {s.file.type.split("/")[1].toUpperCase()}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {submitting ? (
          <div className="mt-6">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Uploading to secure storage…</span>
              <span className="font-mono text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="text-xs text-muted-foreground">
            Submitting routes the application to the <span className="font-medium text-foreground">Lab in-charge</span> first.
          </p>
          <Button onClick={submit} disabled={!allReady || submitting} size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Submit application
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
