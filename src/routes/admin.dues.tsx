import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PlaceholderDashboard } from "./student.dashboard";

export const Route = createFileRoute("/admin/dues")({
  component: AdminDues,
});

function AdminDues() {
  const { profile, loading, signOut } = useAuth();
  return (
    <PlaceholderDashboard
      role="Admin"
      greeting={profile ? `Welcome, ${profile.full_name}` : "Welcome"}
      subtitle="Dues reconciliation engine"
      onSignOut={signOut}
      loading={loading}
    />
  );
}
