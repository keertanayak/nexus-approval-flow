import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useAuth, dashboardPathForRole, primaryRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, roles, signOut, loading } = useAuth();
  const dashPath = user ? dashboardPathForRole(primaryRole(roles)) : "/sign-in";

  return (
    <header className="sticky top-0 z-40 w-full px-3 pt-3 sm:px-5">
      <div className="glass-panel mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-white/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
            <ShieldCheck className="h-6 w-6 drop-shadow-md" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-2xl font-black tracking-tighter uppercase italic bg-gradient-to-br from-primary via-primary/80 to-primary/50 bg-clip-text text-transparent drop-shadow-sm">
              Nexus
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70 flex items-center gap-1">
              <span className="h-px w-2 bg-primary/30" />
              Clearance Protocol
              <span className="h-px w-2 bg-primary/30" />
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
