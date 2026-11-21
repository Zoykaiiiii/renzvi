// Au-dessus d'un Supabase local lancé et migré. Seule l'API Whop est simulée.
import assert from 'node:assert/strict';
import { whopSandbox } from '../supabase/functions/whop/handler.ts';

const supabaseUrl = Deno.env.get('WHOP_TEST_SUPABASE_URL') ?? '';
const publishableKey = Deno.env.get('WHOP_TEST_SUPABASE_PUBLISHABLE_KEY') ?? '';
const serviceKey = Deno.env.get('WHOP_TEST_SUPABASE_SECRET_KEY') ?? '';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(supabaseUrl).hostname), 'Supabase local uniquement');
assert.ok(publishableKey && serviceKey);

Deno.test('checkout lié à un seul compte, webhook signé, répétitions et fin des droits', async () => {
  const runId = crypto.randomUUID().replaceAll('-', '');
  const account = 'biz_fixture', variant = 'plan_fixture', checkout = `ch_${runId}`, membershipId = `mem_${runId}`;
  const webhookSecret = `ws_${crypto.randomUUID()}`;
  const dashboardUrl = 'http://localhost:3000/espace';
  const local = (path: string, token = serviceKey, method = 'GET', data?: unknown) => fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: token === serviceKey ? serviceKey : publishableKey,
      ...(!token.startsWith('sb_secret_') && { Authorization: `Bearer ${token}` }),
      'Content-Type': 'application/json',
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const read = async <T>(response: Response): Promise<T> => {
    assert.ok(response.ok, `${response.status} ${await response.clone().text()}`);
    return await response.json();
  };
  const createAccount = async () => {
    const credentials = { email: `whop-${crypto.randomUUID()}@example.com`, password: crypto.randomUUID() };
    const { id } = await read<{ id: string }>(await local('/auth/v1/admin/users', serviceKey, 'POST', { ...credentials, email_confirm: true }));
    const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
    });
    return { id, token: (await read<{ access_token: string }>(auth)).access_token };
  };
  const buyer = await createAccount(), other = await createAccount();
  const plan = async (token: string) => read<string>(await local('/rest/v1/rpc/renzvi_plan', token, 'POST', {}));
  const subscription = async (token: string) =>
    read<{ statut: string; fin: string; updated_at: string; whop_membership_id: string }[]>(await local('/rest/v1/abonnements', token));

  const periodEnd = new Date(Date.now() + 86400_000).toISOString();
  const now = Date.now();
  const state = {
    id: membershipId, account: { id: account }, variant_id: variant, status: 'active', cancel_at_period_end: false,
    expires_at: null, current_period_end: periodEnd, updated_at: new Date(now).toISOString(),
  };
  let whopCalls = 0, wrongPrice = false;
  const run = whopSandbox({ supabaseUrl, publishableKey, serviceKey, apiKey: 'fixture', webhookSecret, account, variant, dashboardUrl },
    (address, options) => {
      const url = new URL(String(address));
      if (url.origin === new URL(supabaseUrl).origin) return fetch(address, options);
      assert.equal(url.origin, 'https://sandbox-api.whop.com');
      assert.equal(new Headers(options?.headers).get('api-version-date'), '2026-11-20');
      whopCalls++;
      switch (url.pathname) {
        case '/api/v1/accounts/me':
          return Promise.resolve(Response.json({ id: account, status: 'active', capabilities: { accept_card_payments: 'active' } }));
        case `/api/v1/variants/${variant}`:
          return Promise.resolve(Response.json({ id: variant, account: { id: account }, currency: 'eur', tax_type: 'inclusive',
            initial_price: 0, renewal_price: wrongPrice ? 1 : 9.99, billing_type: 'renewal', billing_period: 30, trial_period_days: 0 }));
        case '/api/v1/checkout_configurations':
          assert.deepEqual(JSON.parse(String(options?.body)), {
            account_id: account, variant_id: variant, redirect_url: `${dashboardUrl}?whop=retour`,
          });
          return Promise.resolve(Response.json({ id: checkout, purchase_url: `https://sandbox.whop.com/checkout/${checkout}/` }));
        case `/api/v1/memberships/${membershipId}`:
          return Promise.resolve(Response.json(state));
        default:
          throw new Error('Unexpected Whop request');
      }
    });
  const startCheckout = (token: string, origin = 'http://localhost:3000') =>
    run(new Request(`${supabaseUrl}/functions/v1/whop/checkout`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: origin },
      body: JSON.stringify({ user_id: other.id, variant_id: 'plan_from_browser' }),
    }));
  const sigKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const delivery = async (message: string, type: string, data: object, options: { stale?: boolean; tamper?: boolean } = {}) => {
    message = `${message}_${runId}`;
    const body = JSON.stringify({ id: message, api_version: 'v1', api_version_date: '2026-11-20', account_id: account, type, data });
    const timestamp = String(Math.floor(Date.now() / 1000) - (options.stale ? 600 : 0));
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', sigKey, new TextEncoder().encode(`${message}.${timestamp}.${body}`)));
    return run(new Request(`${supabaseUrl}/functions/v1/whop/webhook`, {
      method: 'POST', body: options.tamper ? `${body} ` : body,
      headers: { 'webhook-id': message, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${btoa(String.fromCharCode(...signature))}` },
    }));
  };
  const payment = { status: 'paid', id: 'pay_fixture', membership_id: membershipId, paid_at: new Date(now).toISOString(),
    checkout_configuration_id: checkout, account_id: account, variant_id: variant };

  try {
    assert.equal((await startCheckout('expired-or-forged')).status, 401);
    assert.equal((await startCheckout(buyer.token, 'https://not-the-test-app.example')).status, 403);
    assert.equal(whopCalls, 0);
    wrongPrice = true;
    assert.equal((await startCheckout(buyer.token)).status, 503);
    wrongPrice = false;
    assert.deepEqual(await read(await startCheckout(buyer.token)), { url: `https://sandbox.whop.com/checkout/${checkout}/` });
    assert.deepEqual(await Promise.all([plan(buyer.token), plan(other.token)]), ['gratuit', 'gratuit']);
    assert.equal((await local('/rest/v1/whop_test_checkouts', other.token)).status, 403);
    assert.equal((await local('/rest/v1/rpc/whop_test_apply', other.token, 'POST', {
      p_event: 'msg_spoof', p_membership: membershipId, p_checkout: checkout, p_statut: 'actif',
      p_fin: periodEnd, p_updated: state.updated_at,
    })).status, 403);

    assert.equal((await delivery('msg_invalid', 'payment.succeeded', payment, { tamper: true })).status, 400);
    assert.equal((await delivery('msg_stale', 'payment.succeeded', payment, { stale: true })).status, 400);
    assert.equal((await delivery('msg_unknown', 'payment.succeeded', { ...payment, checkout_configuration_id: 'ch_unknown' })).status, 200);
    assert.equal((await delivery('msg_open', 'payment.succeeded', { ...payment, status: 'open' })).status, 200);
    assert.equal((await delivery('msg_membership_first', 'membership.updated', state)).status, 200);
    assert.equal(await plan(buyer.token), 'gratuit');

    const receipts = await Promise.all([
      delivery('msg_payment', 'payment.succeeded', payment), delivery('msg_payment', 'payment.succeeded', payment),
    ]);
    assert.deepEqual(receipts.map(r => r.status), [200, 200]);
    assert.deepEqual(await Promise.all([plan(buyer.token), plan(other.token)]), ['pro', 'gratuit']);
    assert.deepEqual(await subscription(other.token), []);
    const activated = await subscription(buyer.token);
    assert.equal(activated[0].statut, 'actif');
    assert.equal(activated[0].whop_membership_id, membershipId);
    assert.equal((await delivery('msg_payment', 'payment.succeeded', payment)).status, 200);
    assert.equal((await delivery('msg_same_state', 'membership.updated', state)).status, 200);
    assert.deepEqual(await subscription(buyer.token), activated);
    assert.equal((await startCheckout(buyer.token)).status, 409);

    const canceled = { ...state, cancel_at_period_end: true, updated_at: new Date(now + 1000).toISOString() };
    assert.equal((await delivery('msg_renewal_off', 'membership.updated', canceled)).status, 200);
    assert.equal(await plan(buyer.token), 'pro');
    const scheduled = await subscription(buyer.token);
    assert.equal(scheduled[0].statut, 'annule');
    assert.equal(Date.parse(scheduled[0].fin), Date.parse(periodEnd));

    const cutoff = Date.now() + 1800;
    const expiring = { ...canceled, current_period_end: new Date(cutoff).toISOString(), updated_at: new Date(now + 2000).toISOString() };
    assert.equal((await delivery('msg_cutoff', 'membership.updated', expiring)).status, 200);
    assert.equal(await plan(buyer.token), 'pro');
    await new Promise(resolve => setTimeout(resolve, Math.max(0, cutoff - Date.now() + 100)));
    assert.equal(await plan(buyer.token), 'gratuit', 'renzvi_plan applique aussi l’échéance sans nouvelle livraison');

    const ended = { ...expiring, status: 'canceled', updated_at: new Date(now + 3000).toISOString() };
    assert.equal((await delivery('msg_access_end', 'membership.updated', ended)).status, 200);
    assert.equal((await delivery('msg_late_cancel', 'membership.updated', canceled)).status, 200);
    assert.equal((await delivery('msg_late_payment', 'payment.succeeded', payment)).status, 200);
    assert.deepEqual(await Promise.all([plan(buyer.token), plan(other.token)]), ['gratuit', 'gratuit']);
    assert.equal((await subscription(buyer.token))[0].statut, 'expire');
  } finally {
    for (const user of [buyer, other]) await local(`/auth/v1/admin/users/${user.id}`, serviceKey, 'DELETE');
  }
});
