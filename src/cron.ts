import { checkStaleApplications } from "./lib/stale-checker";

/**
 * Main cron job entry point.
 * This script runs every 24 hours to check for stale applications.
 * Can be triggered via a standard Node.js process using a wrapper around 
 * node-cron or scheduled via a system-level cron job (e.g., in a Docker container or server).
 * 
 * In a real environment, you might use an edge function (e.g., Supabase Edge Functions with a cron schedule)
 */
async function runStaleCheckCron() {
  console.log("-----------------------------------------");
  console.log(`Cron Job Started: ${new Date().toISOString()}`);
  console.log("Task: Daily Stale Application Check");
  
  try {
    await checkStaleApplications();
    console.log("Cron Job Result: Success");
  } catch (error) {
    console.error("Cron Job Result: Failed with error:", error);
  }

  console.log("-----------------------------------------");
}

// In a real environment, you'd have a server-side entry point
// For now, let's create a main function that runs synchronously
// or can be executed as a background script
runStaleCheckCron();
