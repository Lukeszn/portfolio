// Checkout completed: empty the basket and remove the session id from the address bar.
// The project details were saved on the Stripe Checkout Session, and the Stripe webhook
// (netlify/functions/stripe-webhook.js) sends them to the "order-details" Netlify form.
try {
  localStorage.removeItem('ls-basket-v2');
  localStorage.removeItem('ls-basket-v1');
  localStorage.removeItem('ls-order-pending');
} catch { /* storage unavailable */ }
history.replaceState(null, '', location.pathname);
