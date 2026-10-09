// Receives Stripe webhook events (payments, subscription renewals, failures, cancellations).
//
// Endpoint URL to register in Stripe (Developers → Webhooks → Add destination):
//   https://lukereaney.com/.netlify/functions/stripe-webhook
// Events to send:
//   checkout.session.completed, checkout.session.async_payment_succeeded,
//   checkout.session.async_payment_failed, invoice.paid, invoice.payment_failed,
//   customer.subscription.updated, customer.subscription.deleted
//
// Environment variables:
//   STRIPE_SECRET_KEY      – same key as the checkout function
//   STRIPE_WEBHOOK_SECRET  – the endpoint's signing secret (whsec_…). Never commit it.
//
// There's no database on this site, so each event is written to the Netlify function log
// (Netlify → Logs → Functions). Stripe also emails you about new payments, and every order,
// invoice and subscription is in the Stripe Dashboard.
// fulfil() below also sends each paid project's details to the "order-details" Netlify form.

const Stripe = require('stripe');

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

// Rebuild each project from the session metadata written by create-checkout-session.js
function projectsFromMetadata(metadata) {
  const meta = metadata || {};
  return Object.keys(meta)
    .filter(k => /^p\d+$/.test(k))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map(k => {
      const [product, firstName, lastName, email, business] = String(meta[k]).split(' | ');
      const details = Object.keys(meta)
        .filter(c => c.startsWith(k + '_d'))
        .sort((a, b) => Number(a.split('_d')[1]) - Number(b.split('_d')[1]))
        .map(c => meta[c])
        .join('');
      return { product, firstName, lastName, email, business, details };
    });
}

// Send one project to the "order-details" Netlify form (defined in success.html),
// which stores it under Netlify → Forms and triggers its email notifications.
async function sendToOrderForm(session, project) {
  const siteUrl = (process.env.URL || '').replace(/\/$/, '');
  if (!siteUrl) throw new Error('URL environment variable is not set');
  const body = new URLSearchParams({
    'form-name': 'order-details',
    'bot-field': '',
    subject: 'Paid order: ' + (project.product || 'project') + ' (' + session.id + ')',
    first_name: project.firstName || '',
    last_name: project.lastName || '',
    email: project.email || (session.customer_details && session.customer_details.email) || '',
    product: project.product || '',
    session_id: session.id,
    message: [project.business ? 'business: ' + project.business : '', project.details].filter(Boolean).join('\n')
  });
  const res = await fetch(siteUrl + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!res.ok) throw new Error('Netlify form returned ' + res.status);
}

async function fulfil(session) {
  const projects = projectsFromMetadata(session.metadata);
  console.log('ORDER PAID', JSON.stringify({
    session: session.id,
    mode: session.mode,
    customer: session.customer,
    email: session.customer_details && session.customer_details.email,
    amount_total: session.amount_total,
    currency: session.currency,
    subscription: session.subscription || null,
    projects: projects.map(p => p.product)
  }));
  for (const project of projects) {
    try {
      await sendToOrderForm(session, project);
    } catch (err) {
      // The full details stay on the Checkout Session's metadata in the Stripe Dashboard
      console.error('Could not deliver project details for', session.id, project.product, err && err.message);
    }
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    console.error('Stripe webhook is not configured (missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET)');
    return reply(500, { error: 'Not configured' });
  }

  // Signature verification needs the exact raw body Stripe sent
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : (event.body || '');
  const signature = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    const stripe = new Stripe(secretKey);
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.warn('Rejected webhook with invalid signature:', err && err.message);
    return reply(400, { error: 'Invalid signature' });
  }

  const obj = stripeEvent.data.object;
  switch (stripeEvent.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      // Bank payments can complete checkout before the money arrives: only fulfil once paid
      if (obj.payment_status !== 'unpaid') await fulfil(obj);
      else console.log('Checkout completed, awaiting bank payment:', obj.id);
      break;
    case 'checkout.session.async_payment_failed':
      console.warn('Bank payment failed for checkout', obj.id, obj.customer_details && obj.customer_details.email);
      break;
    case 'invoice.paid':
      console.log('Invoice paid:', obj.id, obj.amount_paid, obj.currency, 'subscription-related:', Boolean(obj.parent && obj.parent.subscription_details));
      break;
    case 'invoice.payment_failed':
      // Stripe's Smart Retries and failed-payment emails handle recovery (Dashboard → Billing → Revenue recovery)
      console.warn('Invoice payment failed:', obj.id, obj.customer_email);
      break;
    case 'customer.subscription.updated':
      console.log('Subscription updated:', obj.id, 'status', obj.status, 'cancel_at_period_end', obj.cancel_at_period_end);
      break;
    case 'customer.subscription.deleted':
      console.log('Subscription ended:', obj.id, 'customer', obj.customer);
      break;
    default:
      // Unsubscribed event types are acknowledged and ignored
      break;
  }

  return reply(200, { received: true });
};
