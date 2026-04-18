import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const Body = z.object({
  due_id: z.string().uuid(),
  session_id: z.string().min(1),
});

const STAFF_ROLES: AppRole[] = ["admin", "principal"];

let stripeClient: Stripe | null = null;

function validateStripeSecretKey(secretKey: string) {
  const isProd = process.env.NODE_ENV === "production";
  const expectedPrefix = isProd ? "sk_live_" : "sk_test_";
  if (!secretKey.startsWith(expectedPrefix)) {
    throw new Error(
      isProd
        ? "STRIPE_SECRET_KEY must be a live key in production"
        : "STRIPE_SECRET_KEY must be a test key in sandbox/development",
    );
  }
}

function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }
    validateStripeSecretKey(key);
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

type PaymentActor = {
  userId: string;
  isStaff: boolean;
  profileId: string | null;
};

async function requirePaymentActor(request: Request): Promise<
  { actor: PaymentActor } | { error: Response }
> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const {
    data: { user },
    error: userErr,
  } = await supabaseAdmin.auth.getUser(token);

  if (userErr || !user) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: roleRows, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleErr) {
    return { error: Response.json({ error: roleErr.message }, { status: 500 }) };
  }

  const roles = (roleRows ?? []).map((r) => r.role as AppRole);
  const isStaff = roles.some((role) => STAFF_ROLES.includes(role));
  const isStudent = roles.includes("student");

  if (!isStaff && !isStudent) {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  let profileId: string | null = null;
  if (!isStaff) {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr) {
      return { error: Response.json({ error: profileErr.message }, { status: 500 }) };
    }

    if (!profile) {
      return { error: Response.json({ error: "Student profile not found" }, { status: 403 }) };
    }

    profileId = profile.id;
  }

  return {
    actor: {
      userId: user.id,
      isStaff,
      profileId,
    },
  };
}

export const Route = createFileRoute("/api/stripe/confirm-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = await requirePaymentActor(request);
          if ("error" in auth) return auth.error;
          const { actor } = auth;

          const json = await request.json();
          const parsed = Body.safeParse(json);
          if (!parsed.success) {
            return Response.json({ error: "Invalid body" }, { status: 400 });
          }

          const { due_id, session_id } = parsed.data;

          const { data: due, error: dueErr } = await supabaseAdmin
            .from("dues")
            .select("*")
            .eq("id", due_id)
            .maybeSingle();

          if (dueErr || !due) {
            return Response.json({ error: "Due not found" }, { status: 404 });
          }

          if (!actor.isStaff && actor.profileId !== due.student_id) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          if (due.status === "paid") {
            return Response.json({ ok: true, already_paid: true });
          }

          const stripe = getStripe();
          const session = await stripe.checkout.sessions.retrieve(session_id);

          if (session.mode !== "payment") {
            return Response.json({ error: "Invalid checkout session mode" }, { status: 400 });
          }

          const metadataDueId = session.metadata?.due_id;
          if (!metadataDueId || metadataDueId !== due_id) {
            return Response.json({ error: "Session does not match due" }, { status: 400 });
          }

          const metadataStudentId = session.metadata?.student_id;
          if (!metadataStudentId || metadataStudentId !== due.student_id) {
            return Response.json({ error: "Session student mismatch" }, { status: 400 });
          }

          if (session.payment_status !== "paid") {
            return Response.json({ error: "Payment not completed" }, { status: 400 });
          }

          const expectedAmount = Math.round(Number(due.amount) * 100);
          if (session.currency !== "inr" || session.amount_total !== expectedAmount) {
            return Response.json({ error: "Payment amount/currency mismatch" }, { status: 400 });
          }

          const { error: updErr } = await supabaseAdmin
            .from("dues")
            .update({ status: "paid" })
            .eq("id", due_id)
            .eq("status", "pending");

          if (updErr) {
            return Response.json({ error: updErr.message }, { status: 500 });
          }

          return Response.json({ ok: true, already_paid: false });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Server error";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
