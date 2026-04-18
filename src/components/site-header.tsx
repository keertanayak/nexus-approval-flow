import { Link } from "@tanstack/react-router";
import { Hexagon } from "lucide-react";
import { useAuth, dashboardPathForRole, primaryRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, roles, signOut, loading } = useAuth();
  const dashPath = user ? dashboardPathForRole(primaryRole(roles)) : "/sign-in";

  return (
    <header className="sticky top-0 z-40 w-full px-3 pt-3 sm:px-5">
      <div className="glass-panel mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground ring-1 ring-white/30 transition-transform group-hover:scale-105">
            <Hexagon className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl tracking-tight">Nexus</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              Clearance Protocol
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#roles" className="transition-colors hover:text-foreground">
            For roles
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to={dashPath}>Dashboard</Link>
              </Button>
              <Button onClick={() => signOut()} size="sm" variant="outline">
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/sign-in">Sign in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Link to="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
