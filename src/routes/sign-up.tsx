import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  useAuth,
  primaryRole,
  dashboardPathForRole,
  type AppRole,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthShell } from "./sign-in";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Sign up — Nexus" },
      {
        name: "description",
        content:
          "Create your Nexus account and land directly on the dashboard built for your role.",
      },
    ],
  }),
  component: SignUpPage,
});

const schema = z.object({
  fullName: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(128),
  rollNo: z.string().trim().max(50).optional(),
  department: z.string().trim().min(1, "Department required").max(100),
  role: z.enum(["student", "lab_incharge", "hod", "principal", "admin"]),
});

const ROLE_OPTIONS: { value: AppRole; label: string; hint: string }[] = [
  { value: "student", label: "Student", hint: "Submit clearance & track status" },
  { value: "lab_incharge", label: "Lab in-charge", hint: "First approver" },
  { value: "hod", label: "HOD", hint: "Department head approval" },
  { value: "principal", label: "Principal", hint: "Final approval & certificate" },
  { value: "admin", label: "Admin / Registrar", hint: "Manages dues & payments" },
];

function SignUpPage() {
  const nav = useNavigate();
  const { user, roles, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    rollNo: "",
    department: "",
    role: "student" as AppRole,
  });

  useEffect(() => {
    if (!loading && user) {
      nav({ to: dashboardPathForRole(primaryRole(roles)), replace: true });
    }
  }, [loading, user, roles, nav]);

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: parsed.data.fullName,
          roll_no: parsed.data.rollNo ?? "",
          department: parsed.data.department,
          role: parsed.data.role,
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created — redirecting…");
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Choose a role to land on the right dashboard."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            required
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="Aditi Sharma"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rollNo">Roll number</Label>
            <Input
              id="rollNo"
              value={form.rollNo}
              onChange={(e) => set("rollNo", e.target.value)}
              placeholder="22BCE1043"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              required
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              placeholder="CSE"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role">Role</Label>
          <Select
            value={form.role}
            onValueChange={(v) => set("role", v as AppRole)}
          >
            <SelectTrigger id="role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{r.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {r.hint}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@university.edu"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#035a80] text-white hover:bg-[#035a80]/90"
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/sign-in" className="font-bold text-[#035a80] hover:text-[#035a80]/80 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
