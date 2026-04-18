# Nexus Approval Flow

A secure, automated document clearance and approval system for educational institutions, integrated with Supabase and Stripe.

## 🚀 Features

- **Multi-Role Dashboards**: Specific views and permissions for Students, Lab In-charges, HODs, and Principals.
- **Smart Document Vault**: Secure document uploads with role-based access control via Supabase Storage.
- **Automated Approval Pipeline**: Visual status tracking and automated routing of clearance applications.
- **Dues & Payments**: Integrated Stripe sandbox for student fee payments with real-time status updates.
- **Dynamic Heatmaps**: Visual progress tracking for application stages.
- **Certificate Generation**: Secure issuance and verification of clearance certificates.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Shadcn UI, TanStack Router.
- **Backend/Database**: Supabase (Auth, Postgres, Storage, Edge Functions).
- **Payments**: Stripe API (Test Mode).
- **Icons**: Lucide React.

## 🏁 Getting Started

### Prerequisites

- Node.js (Latest LTS)
- Bun (Optional, used for lockfile)
- Supabase Account
- Stripe Account (Developer keys)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd nexus-approval-flow
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root and add your keys (see `.env.example`):

   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
   STRIPE_SECRET_KEY=your_stripe_test_secret
   VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_test_publishable
   ```

4. Database Setup:
   - Run the provided SQL migration in the Supabase SQL Editor to set up tables, enums, triggers, and RLS policies.
   - Ensure the `nexus-documents` and `nexus-certificates` buckets are created in Supabase Storage.

5. Start the development server:
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `src/components/ui`: Reusable UI components powered by Shadcn.
- `src/integrations/supabase`: Supabase client and auto-generated types.
- `src/routes`: Application routing and page components.
- `supabase/migrations`: Database schema history.

## 🔒 Security

- **RLS Policies**: Row-Level Security ensures users can only access their own data or data they are authorized to approve.
- **Server-Side Validation**: Critical actions like payment confirmation and document access are validated on the server.
- **Environment Hygiene**: Sensitive keys are kept out of source control.

## 📜 License

MIT
