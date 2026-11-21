import { unwrapWebhook } from 'npm:@whop/sdk@2.8.1/helpers';

const WHOP_URL = 'https://sandbox-api.whop.com/api/v1';
const API_DATE = '2026-11-20';
const LIVE_PROJECT = 'xjkmztfsyyccveaeyzov';
const LIVE_HOSTS = ['renzvi.vercel.app', 'renzvi-site.vercel.app'];
const id = (value: unknown, prefix: string): value is string =>
  typeof value === 'string' && value.startsWith(prefix) && /^[a-zA-Z0-9_]{4,128}$/.test(value);
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

type Config = {
  supabaseUrl: string; publishableKey: string; serviceKey: string;
  apiKey: string; webhookSecret: string; account: string; variant: string; dashboardUrl: string;
};

type Membership = {
  id?: string; variant_id?: string; account?: { id?: string };
  status?: string; cancel_at_period_end?: boolean; current_period_end?: string | null;
  expires_at?: string | null; updated_at?: string;
};

type Event = {
  api_version?: string; api_version_date?: string; account_id?: string; type?: string;
  data?: Membership & { account_id?: string;
    membership_id?: string; checkout_configuration_id?: string | null; paid_at?: string | null };
};

function dashboard(config: Config) {
  const url = new URL(config.dashboardUrl);
  const supabase = new URL(config.supabaseUrl);
  if (supabase.hostname.includes(LIVE_PROJECT) || LIVE_HOSTS.includes(url.hostname) ||
      (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) ||
      !['/espace', '/dashboard.html'].includes(url.pathname) || url.username || url.password ||
      url.search || url.hash) throw new Error('invalid_sandbox_url');
  return url;
}

export function whopSandbox(config: Config, request = fetch) {
  const configured = Object.values(config).every(Boolean);
  const origin = configured ? dashboard(config).origin : '';
  const authHeaders = (token: string) => ({ apikey: config.publishableKey, Authorization: `Bearer ${token}` });
  const serviceHeaders = {
    apikey: config.serviceKey,
    ...(!config.serviceKey.startsWith('sb_secret_') && { Authorization: `Bearer ${config.serviceKey}` }),
    'Content-Type': 'application/json',
  };
  const whop = (path: string, init?: RequestInit) => request(`${WHOP_URL}${path}`, {
    ...init, redirect: 'error', signal: AbortSignal.timeout(3500),
    headers: {
      Authorization: `Bearer ${config.apiKey}`, 'Api-Version-Date': API_DATE, 'Content-Type': 'application/json',
    },
  });

  const read = async <T>(response: Response, operation: string): Promise<T> => {
    if (!response.ok) throw new Error(`${operation}_${response.status}`);
    return await response.json() as T;
  };

  return async (req: Request): Promise<Response> => {
    const incomingOrigin = req.headers.get('origin');
    const cors = incomingOrigin && incomingOrigin === origin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    } : undefined;
    const json = (status: number, body: Record<string, string>) =>
      Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
    if (!configured || !id(config.account, 'biz_') || !id(config.variant, 'plan_')) return json(503, { error: 'sandbox_unavailable' });
    const route = new URL(req.url).pathname.split('/').at(-1);
    if (req.method === 'OPTIONS' && route === 'checkout' && cors) return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json(405, { error: 'method' });

    try {
      if (route === 'checkout') {
        if (incomingOrigin && !cors) return json(403, { error: 'origin' });
        const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
        if (!token) return json(401, { error: 'session' });
        const auth = await request(`${config.supabaseUrl}/auth/v1/user`, { headers: authHeaders(token) });
        if (auth.status === 401 || auth.status === 403) return json(401, { error: 'session' });
        const user = await read<{ id?: string; is_anonymous?: boolean }>(auth, 'auth');
        if (!user.id || user.is_anonymous) return json(401, { error: 'session' });

        const [plan, prices] = await Promise.all([
          request(`${config.supabaseUrl}/rest/v1/rpc/renzvi_plan`, { method: 'POST', headers: authHeaders(token) }),
          request(`${config.supabaseUrl}/rest/v1/plans?id=eq.pro&select=prix_mensuel_ttc_centimes`, { headers: authHeaders(token) }),
        ]);
        if (await read<string>(plan, 'current_plan') !== 'gratuit') return json(409, { error: 'already_subscribed' });
        const [price] = await read<{ prix_mensuel_ttc_centimes: number }[]>(prices, 'pro_price');

        const [account, variant] = await Promise.all([
          whop('/accounts/me').then(r => read<{ id: string; status: string; capabilities?: { accept_card_payments?: string } }>(r, 'whop_account')),
          whop(`/variants/${config.variant}`).then(r => read<{
            id: string; account?: { id: string }; currency: string; billing_type: string; billing_period: number;
            initial_price: number; renewal_price: number; trial_period_days: number | null; tax_type: string;
          }>(r, 'whop_variant')),
        ]);
        if (account.id !== config.account || account.status !== 'active' || account.capabilities?.accept_card_payments !== 'active' ||
            variant.id !== config.variant || variant.account?.id !== config.account || variant.billing_type !== 'renewal' ||
            variant.billing_period !== 30 || variant.currency !== 'eur' || variant.tax_type !== 'inclusive' ||
            (variant.trial_period_days ?? 0) !== 0 || variant.initial_price !== 0 ||
            !price || price.prix_mensuel_ttc_centimes <= 0 || variant.renewal_price !== price.prix_mensuel_ttc_centimes / 100) {
          return json(503, { error: 'sandbox_offer_unavailable' });
        }
        const returnUrl = new URL(config.dashboardUrl);
        returnUrl.searchParams.set('whop', 'retour');
        const checkout = await read<{ id?: string; purchase_url?: string }>(await whop('/checkout_configurations', {
          method: 'POST',
          body: JSON.stringify({ account_id: config.account, variant_id: config.variant, redirect_url: returnUrl.href }),
        }), 'whop_checkout');
        if (!id(checkout.id, 'ch_') || !checkout.purchase_url) throw new Error('unexpected_checkout');
        const url = new URL(checkout.purchase_url);
        if (url.origin !== 'https://sandbox.whop.com' || url.username || url.password ||
            url.pathname.replace(/\/$/, '') !== `/checkout/${checkout.id}`) throw new Error('unexpected_checkout_url');
        const stored = await request(`${config.supabaseUrl}/rest/v1/whop_test_checkouts`, {
          method: 'POST', headers: serviceHeaders, body: JSON.stringify({ id: checkout.id, user_id: user.id }),
        });
        if (!stored.ok) throw new Error(`checkout_storage_${stored.status}`);
        return json(200, { url: url.href });
      }

      if (route !== 'webhook') return json(404, { error: 'route' });
      let event: Event;
      const eventId = req.headers.get('webhook-id');
      try {
        event = unwrapWebhook<Event>(await req.text(), { headers: Object.fromEntries(req.headers), key: config.webhookSecret });
      } catch {
        return json(400, { error: 'signature' });
      }
      if (!eventId || !event || event.api_version !== 'v1' || event.api_version_date !== API_DATE) return json(400, { error: 'event_version' });
      const data = event.data;
      if (event.account_id !== config.account || data?.variant_id !== config.variant) return json(200, { status: 'ignored' });

      let membership: Membership;
      let checkout: string | null = null;
      if (event.type === 'payment.succeeded') {
        if (data.account_id !== config.account || data.status !== 'paid' || !date(data.paid_at) ||
            !id(data.membership_id, 'mem_')) return json(200, { status: 'ignored' });
        checkout = id(data.checkout_configuration_id, 'ch_') ? data.checkout_configuration_id : null;
        membership = await read<Membership>(await whop(`/memberships/${data.membership_id}`), 'whop_membership');
        if (membership.id !== data.membership_id) throw new Error('unexpected_membership');
      } else if (event.type === 'membership.updated') {
        membership = data;
      } else {
        return json(200, { status: 'ignored' });
      }

      if (membership.variant_id !== config.variant || membership.account?.id !== config.account) return json(200, { status: 'ignored' });
      if (!id(membership.id, 'mem_') || !date(membership.updated_at) ||
          !['active', 'past_due', 'trialing', 'completed', 'canceled', 'expired', 'unresolved'].includes(membership.status ?? '')) {
        return json(400, { error: 'membership' });
      }
      const end = membership.expires_at ?? membership.current_period_end ?? null;
      const paidPeriod = ['active', 'past_due'].includes(membership.status ?? '') && date(end);
      const applied = await request(`${config.supabaseUrl}/rest/v1/rpc/whop_test_apply`, {
        method: 'POST', headers: serviceHeaders,
        body: JSON.stringify({
          p_event: eventId, p_membership: membership.id, p_checkout: checkout, p_updated: membership.updated_at,
          p_statut: paidPeriod ? (membership.cancel_at_period_end ? 'annule' : 'actif') : 'expire',
          p_fin: date(end) ? end : null,
        }),
      });
      if (!applied.ok) throw new Error(`membership_storage_${applied.status}`);
      return json(200, { status: 'ok' });
    } catch (error) {
      console.error('whop_sandbox', error instanceof Error ? error.message : 'unknown');
      return json(503, { error: 'sandbox_unavailable' });
    }
  };
}
