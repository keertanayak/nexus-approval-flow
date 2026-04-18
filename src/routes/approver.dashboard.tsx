import { createFileRoute } from "@tanstack/react-router";
import { useAuth, primaryRole } from "@/lib/auth";
import { PlaceholderDashboard } from "./student.dashboard";

export const Route = createFileRoute("/approver/dashboard")({
  component: ApproverDashboard,
});

function ApproverDashboard() {
  const { profile, roles, loading, signOut } = useAuth();
  const role = primaryRole(roles);
  const label =
    role === "lab_incharge"
      ? "Lab in-charge"
      : role === "hod"
        ? "HOD"
        : role === "principal"
          ? "Principal"
          : "Approver";

  return (
    <PlaceholderDashboard
      role={label}
      greeting={profile ? `Welcome, ${profile.full_name}` : "Welcome"}
      subtitle={profile?.department ? `Dept · ${profile.department}` : undefined}
      onSignOut={signOut}
      loading={loading}
    />
  );
}
