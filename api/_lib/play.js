// Google Play Developer API for subscriptions (plan section 12). The server asks Google for the truth every time;
// nothing the phone or a notification says is trusted by itself.
import crypto from 'node:crypto';
import { ApiError } from './http.js';
import { timedFetch } from './supabase.js';

const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const b64u = (x) => Buffer.from(x).toString('base64url');
let tokenCache = null;
export const clearPlayCache = () => { tokenCache = null; };

// The service account JSON from Google Cloud goes into GOOGLE_PLAY_SERVICE_ACCOUNT_JSON. Without it purchases are simply not available.
export function playConfig() {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON; if (!raw) return null;
  try { const j = JSON.parse(raw); return j.client_email && j.private_key ? { email: j.client_email, key: j.private_key, pkg: process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.spokenenglish.coach' } : null; } catch (e) { return null; }
}
async function accessToken(cfg) {
  if (tokenCache && tokenCache.exp > Date.now() + 60000) return tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64u(JSON.stringify({ iss: cfg.email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claims}`).sign(cfg.key);
  const r = await timedFetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64u(sig)}` }).toString() }, 10000);
  if (!r.ok) { console.error('play_auth_error', r.status); throw new ApiError(503, 'billing_unavailable'); }
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}
export const STATUS = {
  SUBSCRIPTION_STATE_ACTIVE: 'active', SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'past_due', SUBSCRIPTION_STATE_ON_HOLD: 'past_due', SUBSCRIPTION_STATE_PAUSED: 'past_due',
  SUBSCRIPTION_STATE_PENDING: 'past_due', SUBSCRIPTION_STATE_CANCELED: 'canceled', SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'canceled', SUBSCRIPTION_STATE_EXPIRED: 'expired'
};
export const statusOf = (state) => STATUS[state] || 'expired'; // anything unknown counts as not active
const ms = (x) => (x ? Date.parse(x) : null);
export function parseSubscription(r) {
  const ids = r.externalAccountIdentifiers || {};
  return {
    state: r.subscriptionState || 'SUBSCRIPTION_STATE_UNSPECIFIED', order_id: r.latestOrderId || null, acknowledged: r.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    test: !!r.testPurchase, account_id: ids.obfuscatedExternalAccountId || null, linked_token: r.linkedPurchaseToken || null, start: ms(r.startTime),
    items: (r.lineItems || []).map((li) => ({ product_id: li.productId, expiry: ms(li.expiryTime), auto_renew: !!(li.autoRenewingPlan && li.autoRenewingPlan.autoRenewEnabled), base_plan_id: (li.offerDetails && li.offerDetails.basePlanId) || null }))
  };
}
async function call(method, path, body) {
  const cfg = playConfig(); if (!cfg) throw new ApiError(503, 'billing_unavailable');
  const r = await timedFetch(`${BASE}/${cfg.pkg}/${path}`, { method, headers: { Authorization: `Bearer ${await accessToken(cfg)}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }, 10000);
  return r;
}
export async function getSubscription(purchaseToken) {
  const r = await call('GET', `purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
  if (r.status === 400 || r.status === 404 || r.status === 410) throw new ApiError(400, 'invalid_input', undefined, 'purchase was not found');
  if (!r.ok) { console.error('play_api_error', r.status); throw new ApiError(502, 'upstream_error'); }
  return parseSubscription(await r.json());
}
// New purchases must be acknowledged within 3 days or Google refunds them.
export async function acknowledge(productId, purchaseToken) {
  const r = await call('POST', `purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {});
  if (!r.ok) { console.error('play_ack_error', r.status); throw new ApiError(502, 'upstream_error'); }
}
