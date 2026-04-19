import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { Database } from "../integrations/supabase/types";

// Note: In a production environment, these would be in environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const transporter = nodemailer.createTransport({
  // Configure your email service here
  // For example, using Gmail:
  // service: 'gmail',
  // auth: {
  //   user: process.env.EMAIL_USER,
  //   pass: process.env.EMAIL_PASS
  // }
  host: process.env.EMAIL_HOST || "smtp.example.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Checks for stale applications and sends reminder emails to relevant authorities.
 * An application is considered stale if it hasn't been updated in 2 days.
 */
export async function checkStaleApplications() {
  console.log("Checking for stale applications...");

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // 1. Fetch applications that are not 'rejected' or 'principal_approved'
  // and haven't been updated in the last 2 days.
  const { data: staleApplications, error } = await supabase
    .from("applications")
    .select(`
      id,
      current_stage,
      updated_at,
      profiles (full_name)
    `)
    .not("status", "in", '("rejected","principal_approved")')
    .lt("updated_at", twoDaysAgo.toISOString());

  if (error) {
    console.error("Error fetching stale applications:", error);
    return;
  }

  if (!staleApplications || staleApplications.length === 0) {
    console.log("No stale applications found.");
    return;
  }

  console.log(`Found ${staleApplications.length} stale applications.`);

  for (const app of staleApplications) {
    // 2. Identify the authority for the current stage
    const currentStage = app.current_stage;
    
    // 3. Find users with the role corresponding to the current stage
    // For this example, we assume there's a way to map stage to users.
    // In a real app, you might filter by department as well.
    const { data: authorities, error: authError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", currentStage);

    if (authError || !authorities) {
      console.error(`Error fetching authorities for stage ${currentStage}:`, authError);
      continue;
    }

    // 4. Send reminder emails to each authority
    for (const auth of authorities) {
      // Get the email of the authority (from auth.users table - requires service role or a profile join)
      // Since we can't directly access auth.users reliably without service role, 
      // we'll assume there's an email field in a profiles table or handled via Supabase Auth metadata.
      // For this implementation, we'll use a placeholder or assume a mapping exists.
      
      const recipientEmail = await getAuthorityEmail(auth.user_id);

      if (recipientEmail) {
        await sendReminderEmail(recipientEmail, app.id, currentStage, (app.profiles as any)?.full_name);
      }
    }
  }
}

async function getAuthorityEmail(userId: string): Promise<string | null> {
  // In a real application, you would fetch this from Supabase Auth or a public profiles table
  // For security reasons, Supabase Auth emails are not directly accessible via standard client
  // You might have a `profiles` table that stores the email field.
  const { data, error } = await supabase
    .from("profiles")
    .select("id") // Assuming email is in this table if you added it
    .eq("user_id", userId)
    .single();

  // Mocking email retrieval logic
  // return data?.email || null;
  return `authority-${userId}@nexus-protocol.com`; // Placeholder
}

async function sendReminderEmail(to: string, appId: string, stage: string, studentName: string) {
  const mailOptions = {
    from: '"Nexus Clearance Protocol" <noreply@nexus-protocol.com>',
    to: to,
    subject: `Action Required: Stale Application - ${appId}`,
    text: `Professional Reminder: The clearance application for ${studentName} (ID: ${appId}) has been pending at the ${stage} stage for over 48 hours. Please review and process it to maintain the workflow efficiency.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #0f172a;">Nexus Clearance Protocol</h2>
        <p>Dear Authority,</p>
        <p>This is an automated professional reminder regarding a stale clearance application.</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Application ID:</strong> ${appId}</p>
          <p><strong>Current Stage:</strong> ${stage.replace("_", " ").toUpperCase()}</p>
          <p><strong>Pending Since:</strong> Over 48 hours</p>
        </div>
        <p>Your prompt attention to this request is appreciated to ensure the process remains within the expected timeline.</p>
        <p>Regards,<br>Nexus Automated System</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Reminder email sent to ${to} for application ${appId}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}
