import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  Layers,
  QrCode,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/nexus-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexus — Automated Clearance Protocol" },
      {
        name: "description",
        content:
          "Replace physical no-dues signatures with a secure digital chain of custody. Multi-stage approval, dues reconciliation and QR-verified certificates.",
      },
      {
        property: "og:title",
        content: "Nexus — Automated Clearance Protocol",
      },
      {
        property: "og:description",
        content:
          "A modern digital no-dues clearance system for universities — built around a sequential approval pipeline.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Hero />
      <Pipeline />
      <Features />
      <Roles />
      <CTA />
      <Footer />
    </div>
  );
}

/* ============ HERO ============ */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          backgroundImage: `url(${heroImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 bg-grid opacity-50"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-background/30 via-background/80 to-background"
        aria-hidden
      />

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Built for university registrars & students
          </div>
          <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            The end of the
            <span className="block bg-gradient-to-r from-accent to-emerald-300 bg-clip-text text-transparent">
              no-dues paper trail.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
            Nexus replaces physical signatures with a secure digital chain of
            custody — submit once, watch the clearance flow from your lab
            in-charge to the principal in real time.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-accent text-accent-foreground shadow-[0_8px_30px_-8px] shadow-accent/40 hover:bg-accent/90"
            >
              <Link to="/sign-up">
                Start clearance
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/sign-in">Sign in</Link>
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Tamper-proof PDF
            </span>
            <span className="inline-flex items-center gap-1.5">
              <QrCode className="h-3.5 w-3.5 text-accent" /> QR verifiable
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Workflow className="h-3.5 w-3.5 text-accent" /> Sequential approval
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ PIPELINE PREVIEW ============ */
function Pipeline() {
  const stages = [
    { label: "Submitted", state: "done" },
    { label: "Lab in-charge", state: "done" },
    { label: "HOD review", state: "active" },
    { label: "Principal", state: "pending" },
    { label: "Certificate", state: "pending" },
  ] as const;

  const stateClass = (s: (typeof stages)[number]["state"]) =>
    s === "done"
      ? "bg-success/15 text-success ring-success/30"
      : s === "active"
        ? "bg-warning/15 text-warning ring-warning/30 animate-pulse"
        : "bg-muted text-muted-foreground ring-border";

  return (
    <section id="how" className="border-y border-border/60 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col items-center text-center">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            One submission. A live, sequential chain.
          </h2>
        </div>

        <div className="relative">
          <div className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          <ol className="relative grid gap-3 md:grid-cols-5">
            {stages.map((s, i) => (
              <li
                key={s.label}
                className="relative rounded-xl border border-border bg-card p-4 text-center card-hover"
              >
                <div
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ring-1 ${stateClass(s.state)}`}
                >
                  <span className="text-xs font-semibold">{i + 1}</span>
                </div>
                <div className="mt-3 text-sm font-medium">{s.label}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.state === "done"
                    ? "Cleared"
                    : s.state === "active"
                      ? "In review"
                      : "Pending"}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ============ FEATURES ============ */
function Features() {
  const items = [
    {
      icon: Workflow,
      title: "Multi-stage approval workflow",
      desc: "Sequential routing — Lab in-charge → HOD → Principal — with a digital chain of custody on every action.",
    },
    {
      icon: FileCheck2,
      title: "Smart document vault",
      desc: "Students upload IDs, library receipts and lab manuals. Approvers preview side-by-side with action buttons.",
    },
    {
      icon: ShieldCheck,
      title: "Internal dues reconciliation",
      desc: "Librarians upload a CSV. Nexus auto-flags students and blocks clearance until status flips to paid.",
    },
    {
      icon: QrCode,
      title: "QR-verified certificate",
      desc: "Server-generated, non-editable PDF with a unique QR code linking to a public verification page.",
    },
    {
      icon: Layers,
      title: "Live status heatmap",
      desc: "Color-coded pipeline view — green cleared, yellow pending, red blocked — refreshing every few seconds.",
    },
    {
      icon: GraduationCap,
      title: "Personal digital locker",
      desc: "One-click ZIP export of every uploaded document, receipt and final certificate.",
    },
  ];

  return (
    <section id="features" className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">
            Capabilities
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built end-to-end for the clearance lifecycle.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="group rounded-2xl border border-border bg-card p-6 card-hover"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                <it.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-base font-semibold">{it.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {it.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ ROLES ============ */
function Roles() {
  const roles = [
    {
      name: "Students",
      points: [
        "Submit once, track every stage live",
        "Receive QR-verified certificate instantly",
        "Download a personal digital locker",
      ],
    },
    {
      name: "Approvers",
      points: [
        "Dedicated action dashboard per role",
        "Side-by-side document preview",
        "Approve, flag or reject with comments",
      ],
    },
    {
      name: "Admin & Principal",
      points: [
        "Bulk dues upload via CSV",
        "Sandbox payments unlock pipeline",
        "Final approval issues the certificate",
      ],
    },
  ];

  return (
    <section id="roles" className="border-t border-border/60 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">
            Built for everyone
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            One platform. Three perspectives.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {roles.map((r) => (
            <div
              key={r.name}
              className="rounded-2xl border border-border bg-card p-6 card-hover"
            >
              <h3 className="text-lg font-semibold">{r.name}</h3>
              <ul className="mt-4 space-y-2.5">
                {r.points.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ CTA ============ */
function CTA() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-surface via-surface-elevated to-surface p-10 text-center sm:p-16">
          <div className="absolute inset-0 -z-10 bg-grid opacity-30" aria-hidden />
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to retire the signature queue?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Create an account in seconds. Choose your role and land directly on
            the dashboard built for it.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Link to="/sign-up">
                Create account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/sign-in">I already have one</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nexus · Automated Clearance Protocol
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link to="/sign-in" className="hover:text-foreground">
            Sign in
          </Link>
          <Link to="/sign-up" className="hover:text-foreground">
            Sign up
          </Link>
        </div>
      </div>
    </footer>
  );
}
