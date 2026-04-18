import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Hexagon, Construction, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/student/dashboard")({
  component: StudentDashboard,
});

function StudentDashboard() {
  const { profile, loading, signOut } = useAuth();
  return (
    <PlaceholderDashboard
      role="Student"
      greeting={profile ? `Welcome, ${profile.full_name}` : "Welcome"}
      subtitle={profile?.roll_no ? `Roll · ${profile.roll_no}` : undefined}
      onSignOut={signOut}
      loading={loading}
    />
  );
}

/* shared placeholder used by dashboards we'll build next */
export function PlaceholderDashboard({
  role,
  greeting,
  subtitle,
  onSignOut,
  loading,
}: {
  role: string;
  greeting: string;
  subtitle?: string;
  onSignOut: () => Promise<void>;
  loading?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
              <Hexagon className="h-5 w-5 text-accent" strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Nexus</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                {role} Dashboard
              </div>
            </div>
          </div>
          <Button onClick={() => onSignOut()} size="sm" variant="outline">
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">
            {role}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {loading ? "Loading…" : greeting}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20">
            <Construction className="h-6 w-6 text-accent" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">
            Dashboard coming next
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            The design system, auth and routing are wired. We'll build the live
            status heatmap, document submission and approver action panels in
            the next iteration.
          </p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to home
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
