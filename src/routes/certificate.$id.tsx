import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Hexagon, ShieldCheck, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Certificate = Database["public"]["Tables"]["certificates"]["Row"];
type Application = Database["public"]["Tables"]["applications"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const Route = createFileRoute("/certificate/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Verify Certificate · ${params.id.slice(0, 8)} — Nexus` },
      {
        name: "description",
        content: "Public verification page for a Nexus digital no-dues certificate.",
      },
    ],
  }),
  component: CertificateVerify,
});

function CertificateVerify() {
  const { id } = Route.useParams();
  const [cert, setCert] = useState<Certificate | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: c } = await supabase
        .from("certificates")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!c) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCert(c);
      const { data: a } = await supabase
        .from("applications")
        .select("*")
        .eq("id", c.application_id)
        .maybeSingle();
      setApp(a);
      if (a) {
        const { data: p } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", a.student_id)
          .maybeSingle();
        setProfile(p);
      }
      setLoading(false);
    })();
  }, [id]);

  return (
    <div className="min-h-screen bg-app-fade">
      <header className="border-b border-border/60 bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <Hexagon className="h-5 w-5" strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <div className="font-display text-xl">Nexus</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                Public verification
              </div>
            </div>
          </Link>
          <span className="text-xs text-white/70">Certificate ID · {id.slice(0, 8)}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notFound ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <h1 className="text-xl font-bold text-destructive">Certificate not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This certificate ID is not in the verified registry.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/30">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-success">
                  Verified
                </p>
                <h1 className="text-2xl font-bold tracking-tight">
                  Digital No-Dues Certificate
                </h1>
              </div>
            </div>

            <dl className="mt-8 grid grid-cols-1 gap-y-4 sm:grid-cols-2">
              <Field label="Student name" value={profile?.full_name ?? "—"} />
              <Field label="Roll number" value={profile?.roll_no ?? "—"} mono />
              <Field label="Department" value={profile?.department ?? "—"} />
              <Field
                label="Approved status"
                value={app?.status === "principal_approved" ? "Principal approved" : app?.status ?? "—"}
              />
              <Field
                label="Issued at"
                value={cert ? new Date(cert.issued_at).toLocaleString() : "—"}
              />
              <Field label="Certificate ID" value={id} mono />
            </dl>

            {cert?.certificate_url && (
              <div className="mt-8 border-t border-border pt-6">
                <a
                  href={cert.certificate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open original PDF
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
