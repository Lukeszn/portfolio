// Creates a Stripe Checkout Session for the basket and returns its client secret
// for the embedded payment form.
//
// Card, Apple Pay, Google Pay and bank payments are entered in Stripe's own
// secure iframe, so no payment details ever reach this site.
// Which payment methods appear is controlled in the Stripe Dashboard
// (Settings → Payment methods), not here.
//
// Environment variables (set in Netlify → Site configuration → Environment variables):
//   STRIPE_SECRET_KEY     – required. Preferably a restricted key (rk_…) with write access to
//                           Checkout Sessions and read access to Products & Prices. Never commit it.

const Stripe = require('stripe');
const catalog = require('../../products.json');

const MAX_BODY_BYTES = 65536;
const MAX_DETAILS_CHARS = 5000;
const MAX_LINES = 20;
const MAX_QTY = 10;
const INTEGRATION_ID = 'custom_embedded_web_0001';

const productsById = new Map(catalog.products.map(p => [p.id, p]));

// Origins this function will accept requests from and redirect back to.
// Netlify sets URL (production), DEPLOY_URL and DEPLOY_PRIME_URL (previews) automatically.
function allowedOrigins() {
  return [process.env.URL, process.env.DEPLOY_URL, process.env.DEPLOY_PRIME_URL]
    .filter(Boolean)
    .map(u => u.replace(/\/$/, ''));
}

const baseHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function respond(statusCode, body) {
  return { statusCode, headers: baseHeaders, body: JSON.stringify(body) };
}

// Validate the basket against the server-side catalogue. Prices sent by the
// browser are ignored entirely; only product ids and quantities are trusted.
function parseItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINES) return null;
  const merged = new Map();
  for (const item of raw) {
    if (!item || typeof item.id !== 'string') return null;
    const product = productsById.get(item.id);
    const qty = Number(item.qty);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return null;
    const max = product.interval ? 1 : MAX_QTY;
    merged.set(product.id, Math.min(max, (merged.get(product.id) || 0) + qty));
  }
  return [...merged].map(([id, qty]) => ({ product: productsById.get(id), qty }));
}

// Each basket line is one bespoke project. Its details travel with the order as session
// metadata so the webhook can deliver them once payment is confirmed (customers aren't
// guaranteed to reach the success page). Stripe allows 50 keys of up to 500 characters:
//   p1      "product | first name | last name | email | business"
//   p1_d1.. the project details text, split into 500-character chunks
const META_KEYS = 50;
const META_VALUE_CHARS = 500;

const clean = (v, max) => (typeof v === 'string' ? v : '')
  .replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ')
  .slice(0, max);

function projectMetadata(raw) {
  const items = (Array.isArray(raw) ? raw : []).filter(i => i && productsById.has(i.id)).slice(0, MAX_LINES);
  if (!items.length) return {};
  const keysPerProject = Math.floor(META_KEYS / items.length);
  const metadata = {};
  items.forEach((item, i) => {
    const d = item.details && typeof item.details === 'object' ? item.details : {};
    const field = (v, max) => clean(v, max).replace(/[|\n]/g, ' ').trim();
    metadata[`p${i + 1}`] = [item.id, field(d.first_name, 80), field(d.last_name, 80), field(d.email, 254), field(d.business, 80)]
      .join(' | ').slice(0, META_VALUE_CHARS);

    const chunkCount = keysPerProject - 1;
    let text = clean(d.message, MAX_DETAILS_CHARS).trim();
    if (text.length > chunkCount * META_VALUE_CHARS) {
      text = text.slice(0, chunkCount * META_VALUE_CHARS - 12) + ' [truncated]';
    }
    for (let k = 0; k * META_VALUE_CHARS < text.length && k < chunkCount; k++) {
      metadata[`p${i + 1}_d${k + 1}`] = text.slice(k * META_VALUE_CHARS, (k + 1) * META_VALUE_CHARS);
    }
  });
  return metadata;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { ...respond(405, { error: 'Method not allowed' }), headers: { ...baseHeaders, Allow: 'POST' } };
  }

  const origins = allowedOrigins();
  const origin = (event.headers.origin || '').replace(/\/$/, '');
  if (!origins.includes(origin)) return respond(403, { error: 'Forbidden' });

  if (!/^application\/json\b/i.test(event.headers['content-type'] || '')) {
    return respond(415, { error: 'Expected JSON' });
  }
  if (!event.body || Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    return respond(413, { error: 'Request too large' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return respond(503, { error: 'Online payments are not set up yet. Please get in touch for a quote.' });
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return respond(400, { error: 'Invalid request' });
  }

  const lines = parseItems(data && data.items);
  if (!lines) return respond(400, { error: 'Your basket contains an invalid item. Please refresh and try again.' });

  const stripe = new Stripe(secretKey, { apiVersion: '2026-03-25.dahlia; custom_checkout_payment_form_preview=v1' });

  // Look up the real Products/Prices in Stripe. Product ids match products.json,
  // so the same code works in sandbox and live mode.
  let priced;
  try {
    const found = await stripe.products.list({
      ids: lines.map(l => l.product.id),
      active: true,
      limit: MAX_LINES,
      expand: ['data.default_price']
    });
    const byId = new Map(found.data.map(p => [p.id, p.default_price]));
    priced = lines.map(({ product, qty }) => {
      const price = byId.get(product.id);
      // Refuse rather than charge something different from what the website shows
      const interval = price && price.recurring ? price.recurring.interval : null;
      if (!price || !price.active || price.unit_amount !== product.amount ||
          price.currency !== catalog.currency || interval !== (product.interval || null)) {
        throw new Error(`Stripe price for "${product.id}" is missing or doesn't match products.json`);
      }
      return { price: price.id, quantity: qty, recurring: Boolean(interval) };
    });
  } catch (err) {
    console.error('Stripe catalogue error:', err && err.message);
    return respond(502, { error: 'Checkout is temporarily unavailable. Please try again shortly.' });
  }

  const hasSubscription = priced.some(l => l.recurring);

  const params = {
    ui_mode: 'form',
    mode: hasSubscription ? 'subscription' : 'payment',
    line_items: priced.map(({ price, quantity }) => ({ price, quantity })),
    // Embedded form: Stripe sends the customer here after a successful payment
    return_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    integration_identifier: INTEGRATION_ID,
    metadata: projectMetadata(data.items)
  };
  if (hasSubscription) {
    params.payment_method_collection = 'always';
  } else {
    params.submit_type = 'auto';
    // Subscriptions get invoices automatically; one-off purchases need these to get one too
    params.customer_creation = 'always';
    params.invoice_creation = { enabled: true };
  }

  try {
    const session = await stripe.checkout.sessions.create(params);
    return respond(200, { client_secret: session.client_secret });
  } catch (err) {
    // Log details server-side only; never echo Stripe errors to the browser.
    console.error('Stripe checkout error:', err && err.type, err && err.message);
    return respond(502, { error: 'Checkout is temporarily unavailable. Please try again shortly.' });
  }
};
