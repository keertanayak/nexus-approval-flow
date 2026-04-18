import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Hexagon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  useAuth,
  primaryRole,
  dashboardPathForRole,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in — Nexus" },
      {
        name: "description",
        content: "Sign in to your Nexus clearance dashboard.",
      },
    ],
  }),
  component: SignInPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(128),
});

function SignInPage() {
  const nav = useNavigate();
  const { user, roles, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      nav({ to: dashboardPathForRole(primaryRole(roles)), replace: true });
    }
  }, [loading, user, roles, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    // The auth listener + effect above will redirect.
  };

  return <AuthShell title="Welcome back" subtitle="Sign in to continue your clearance.">
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@university.edu"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <Button
        type="submit"
        disabled={submitting}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
      >
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Sign in
      </Button>
    </form>

    <p className="mt-6 text-center text-sm text-muted-foreground">
      Don't have an account?{" "}
      <Link to="/sign-up" className="font-medium text-accent hover:underline">
        Create one
      </Link>
    </p>
  </AuthShell>;
}

/* ============ Reusable Auth Shell (also used by sign-up) ============ */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden overflow-hidden bg-sidebar lg:block">
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-12 text-sidebar-foreground">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
              <Hexagon className="h-5 w-5 text-accent" strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-base font-semibold">Nexus</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] opacity-70">
                Clearance Protocol
              </div>
            </div>
          </Link>

          <div>
            <p className="text-xl font-medium leading-relaxed">
              "Submit once. Watch your clearance flow — lab in-charge to
              principal — without ever standing in a queue."
            </p>
            <p className="mt-4 text-sm opacity-70">
              The Nexus pipeline · designed for modern universities
            </p>
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
                <Hexagon className="h-5 w-5 text-accent" strokeWidth={2.2} />
              </div>
              <span className="text-lg font-semibold">Nexus</span>
            </Link>
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
