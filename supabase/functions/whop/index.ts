import { whopSandbox } from './handler.ts';

const env = (key: string) => Deno.env.get(key) ?? '';
const defaultKey = (registry: string, legacy: string) => JSON.parse(env(registry) || '{}')?.default ?? env(legacy);
Deno.serve(whopSandbox({
  supabaseUrl: env('SUPABASE_URL'),
  publishableKey: defaultKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
  serviceKey: defaultKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
  apiKey: env('WHOP_SANDBOX_API_KEY'),
  webhookSecret: env('WHOP_SANDBOX_WEBHOOK_SECRET'),
  account: env('WHOP_SANDBOX_ACCOUNT_ID'),
  variant: env('WHOP_SANDBOX_PRO_VARIANT_ID'),
  dashboardUrl: env('WHOP_SANDBOX_DASHBOARD_URL'),
}));
