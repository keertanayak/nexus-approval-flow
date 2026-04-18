import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const Body = z.object({
  due_id: z.string().uuid(),
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
  returnPath: "/admin/payments" | "/student/dashboard";
  email: string | null;
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
      returnPath: isStaff ? "/admin/payments" : "/student/dashboard",
      email: user.email ?? null,
    },
  };
}

export const Route = createFileRoute("/api/stripe/create-checkout")({
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

          const { due_id } = parsed.data;

          const { data: due, error: dueErr } = await supabaseAdmin
            .from("dues")
            .select("*")
            .eq("id", due_id)
            .maybeSingle();

          if (dueErr || !due) {
            return Response.json({ error: "Due not found" }, { status: 404 });
          }

          if (due.status !== "pending") {
            return Response.json({ error: "Due is already paid" }, { status: 400 });
          }

          if (!actor.isStaff && actor.profileId !== due.student_id) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("full_name, roll_no")
            .eq("id", due.student_id)
            .maybeSingle();

          const amount = Number(due.amount);
          if (!Number.isFinite(amount) || amount <= 0) {
            return Response.json({ error: "Invalid due amount" }, { status: 400 });
          }

          const stripe = getStripe();
          const origin = new URL(request.url).origin;
          const unitAmount = Math.round(amount * 100);

          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            customer_email: actor.email ?? undefined,
            client_reference_id: actor.userId,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "inr",
                  unit_amount: unitAmount,
                  product_data: {
                    name: `Nexus dues: ${due.due_type}`,
                    description: `${profile?.full_name ?? "Student"} · ${profile?.roll_no ?? "N/A"}`,
                  },
                },
              },
            ],
            success_url: `${origin}${actor.returnPath}?payment=success&session_id={CHECKOUT_SESSION_ID}&due_id=${due.id}`,
            cancel_url: `${origin}${actor.returnPath}?payment=cancelled&due_id=${due.id}`,
            metadata: {
              due_id: due.id,
              student_id: due.student_id,
              paid_by_user_id: actor.userId,
            },
          });

          if (!session.url) {
            return Response.json({ error: "Failed to create checkout URL" }, { status: 500 });
          }

          return Response.json({ ok: true, checkout_url: session.url, session_id: session.id });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Server error";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
