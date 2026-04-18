import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Hexagon,
  LayoutDashboard,
  FileUp,
  Inbox,
  Coins,
  CreditCard,
  LogOut,
  Menu,
} from "lucide-react";
import { useAuth, primaryRole, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
}

const NAV: NavItem[] = [
  { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["student"] },
  { to: "/student/submit", label: "Submit application", icon: FileUp, roles: ["student"] },
  { to: "/approver/dashboard", label: "Action queue", icon: Inbox, roles: ["lab_incharge", "hod", "principal"] },
  { to: "/admin/dues", label: "Dues management", icon: Coins, roles: ["admin", "principal"] },
  { to: "/admin/payments", label: "Payments sandbox", icon: CreditCard, roles: ["admin", "principal"] },
];

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { profile, roles, signOut, loading, user } = useAuth();
  const role = primaryRole(roles);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((i) => i.roles.includes(role));

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  if (!loading && !user) {
    // Soft guard; router-level guards can be added later
    if (typeof window !== "undefined") {
      window.location.href = "/sign-in";
    }
  }

  return (
    <div className="min-h-screen bg-app-fade">
      {/* Mobile top bar */}
      <div className="glass-panel mx-3 mt-3 flex items-center justify-between rounded-xl px-4 py-3 text-sidebar-foreground md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/16 ring-1 ring-white/25">
            <Hexagon className="h-4 w-4" strokeWidth={2.4} />
          </div>
          <span className="font-display text-lg">Nexus</span>
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 transition-colors hover:bg-white/12"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-[calc(100vh-0px)]">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 m-3 w-72 transform rounded-2xl border border-white/20 bg-[#0D2F56] text-white shadow-[0_26px_48px_-28px_rgba(9,31,47,0.78)] backdrop-blur-2xl transition-transform md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
        >
          <div className="flex h-full flex-col rounded-2xl bg-gradient-to-b from-white/12 to-white/[0.04]">
            <Link to="/" className="hidden items-center gap-2.5 px-6 pt-6 md:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 ring-1 ring-white/20">
                <Hexagon className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <div className="leading-tight">
                <div className="font-display text-xl">Nexus</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                  Clearance Protocol
                </div>
              </div>
            </Link>

            <div className="mt-8 px-3">
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                {roleLabel(role)}
              </div>
              <nav className="space-y-1">
                {items.map((it) => {
                  const active = location.pathname === it.to;
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                        active
                          ? "bg-white/22 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]"
                          : "text-white/80 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <it.icon className="h-4 w-4" />
                      {it.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="mt-auto border-t border-white/10 p-4">
              <div className="mb-3 px-2">
                <div className="truncate text-sm font-medium text-white">
                  {profile?.full_name ?? user?.email ?? "—"}
                </div>
                <div className="truncate text-xs text-white/60">
                  {profile?.roll_no ?? profile?.department ?? user?.email}
                </div>
              </div>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-white/80 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {open && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/35 backdrop-blur-[2px] md:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Main */}
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
            <header className="glass-panel mb-8 rounded-2xl px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {roleLabel(role)}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </header>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function roleLabel(role: AppRole): string {
  switch (role) {
    case "student": return "Student";
    case "lab_incharge": return "Lab in-charge";
    case "hod": return "HOD";
    case "principal": return "Principal";
    case "admin": return "Admin";
  }
}
