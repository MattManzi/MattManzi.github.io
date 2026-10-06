const encoder = new TextEncoder();
export const COOKIE_NAME = '__Host-mm-stats';
export const SESSION_SECONDS = 8 * 60 * 60;

function encode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode('mm-stats-session-v1:' + secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return encode(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
export async function safeEqual(left, right) {
  const hashes = await Promise.all([left, right].map(v => crypto.subtle.digest('SHA-256', encoder.encode(String(v)))));
  const a = new Uint8Array(hashes[0]), b = new Uint8Array(hashes[1]);
  let mismatch = 0;
  for (let i=0; i<a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}
export function configured(env) {
  return Boolean(env.DB && typeof env.ANALYTICS_ADMIN_PASSWORD === 'string' && env.ANALYTICS_ADMIN_PASSWORD.length >= 16);
}
export async function newSession(secret, now = Date.now()) {
  const payload = `${Math.floor(now/1000) + SESSION_SECONDS}.${crypto.randomUUID()}`;
  return `${payload}.${await sign(payload, secret)}`;
}
export async function authenticated(request, env, now = Date.now()) {
  if (!configured(env)) return false;
  const cookie = request.headers.get('Cookie') || '';
  const value = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE_NAME+'='))?.slice(COOKIE_NAME.length+1);
  if (!value || value.length > 200) return false;
  const pieces = value.split('.');
  if (pieces.length !== 3 || !/^\d+$/.test(pieces[0]) || !/^[a-f0-9-]{36}$/.test(pieces[1])) return false;
  const expiry = Number(pieces[0]), seconds = Math.floor(now/1000);
  if (expiry <= seconds || expiry > seconds + SESSION_SECONDS) return false;
  return safeEqual(pieces[2], await sign(pieces.slice(0,2).join('.'), env.ANALYTICS_ADMIN_PASSWORD));
}
export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}
export function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  return origin === new URL(request.url).origin && (!fetchSite || fetchSite === 'same-origin');
}
export async function rateAllowed(request, env, scope, limit, windowSeconds, now=Date.now()) {
  const bucket = Math.floor(now / (windowSeconds*1000));
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // A short-lived HMAC protects against bursts. IPs and full user agents are never stored.
  const marker = await sign(`${scope}:${bucket}:${ip}`, env.ANALYTICS_ADMIN_PASSWORD);
  const expiry = (bucket+2)*windowSeconds*1000;
  const results = await env.DB.batch([
    env.DB.prepare('INSERT INTO analytics_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(marker,expiry),
    env.DB.prepare('DELETE FROM analytics_rate_limits WHERE expires_at < ?').bind(now)
  ]);
  return Number(results[0].results?.[0]?.count || 0) <= limit;
}
