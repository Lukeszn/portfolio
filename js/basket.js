// Basket + secure checkout.
// Each basket line is one bespoke project: a product id plus the project details
// the customer filled in. Lines live in this browser only. Prices are re-checked on
// the server (netlify/functions/create-checkout-session.js), payment details are entered
// in Stripe's embedded payment form. The project details are saved on the Checkout Session
// and the Stripe webhook sends them to the "order-details" Netlify form once payment is confirmed.
(function () {
  const STORAGE_KEY = 'ls-basket-v2';
  const MAX_LINES = 10;
  const MAX_DETAIL_CHARS = 5000;
  const CHECKOUT_ENDPOINT = '/.netlify/functions/create-checkout-session';
  // Publishable keys are safe to include in browser code (unlike secret keys)
  const STRIPE_PUBLISHABLE_KEY = 'pk_live_51UO3TSV05EhEt0sdKzC6XTO29d6gRbXN3OCuPP7375DapaMm1JZ3fsXivjLsgWlnRuQBr5J9j1rF5Z0iVqsFculf00Mu13mKKw';
  const CHECKOUT_APPEARANCE = {
    theme: 'night',
    labels: 'auto',
    inputs: 'spaced',
    variables: {
      borderRadius: '6px',
      colorBackground: '#0c1420',
      colorDanger: '#ff9b93',
      colorPrimary: '#8fb0ff',
      colorSuccess: '#7fd6a4',
      colorText: '#eef2f7',
      colorTextSecondary: '#b9c3d2',
      fontFamily: 'default',
      fontSizeBase: '16px',
      spacingUnit: '4px'
    }
  };

  const els = {
    btn: document.getElementById('basketBtn'),
    count: document.getElementById('basketCount'),
    drawer: document.getElementById('basketDrawer'),
    overlay: document.getElementById('basketOverlay'),
    close: document.getElementById('basketClose'),
    items: document.getElementById('basketItems'),
    empty: document.getElementById('basketEmpty'),
    browse: document.getElementById('basketBrowse'),
    foot: document.getElementById('basketFoot'),
    totals: document.getElementById('basketTotals'),
    checkout: document.getElementById('basketCheckout'),
    status: document.getElementById('basketStatus'),
    pay: document.getElementById('basketPay'),
    payBack: document.getElementById('basketBack'),
    payTotals: document.getElementById('basketPayTotals'),
    payStatus: document.getElementById('basketPayStatus')
  };
  if (!els.drawer) return;

  let products = new Map();
  let basket = load();
  let lastFocus = null;
  let stripeClient = null;
  let paymentForm = null;
  let paying = false;

  const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
  const fmt = pence => money.format(pence / 100).replace(/\.00$/, '');

  function cleanDetails(raw) {
    const d = raw && typeof raw === 'object' ? raw : {};
    const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);
    return {
      first_name: str(d.first_name, 120),
      last_name: str(d.last_name, 120),
      email: str(d.email, 254),
      business: str(d.business, 120),
      message: str(d.message, MAX_DETAIL_CHARS)
    };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(raw)
        ? raw
            .filter(l => l && typeof l.key === 'string' && typeof l.id === 'string')
            .slice(0, MAX_LINES)
            .map(l => ({ key: l.key, id: l.id, details: cleanDetails(l.details) }))
        : [];
    } catch { return []; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(basket)); } catch { /* storage blocked: basket lasts for this visit only */ }
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function priceLabel(p) { return fmt(p.amount) + (p.interval ? '/' + (p.interval === 'month' ? 'mo' : p.interval) : ''); }

  // ── Basket state ──
  // Called by the project form in main.js
  function addItem(id, details) {
    const product = products.get(id);
    if (!product) return { ok: false, error: 'That package is not available right now. Please refresh the page or send a quote request instead.' };
    const line = { key: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), id, details: cleanDetails(details) };

    // A monthly plan can only be bought once per checkout, so a second one replaces the first
    let replaced = false;
    if (product.interval) {
      const existing = basket.findIndex(l => l.id === id);
      if (existing >= 0) { basket[existing] = line; replaced = true; }
    }
    if (!replaced) {
      if (basket.length >= MAX_LINES) return { ok: false, error: 'Your basket is full. Please check out or remove a project first.' };
      basket.push(line);
    }
    save();
    render();
    els.count.classList.remove('bump');
    void els.count.offsetWidth;
    els.count.classList.add('bump');
    return { ok: true, replaced };
  }

  function removeLine(key) {
    basket = basket.filter(l => l.key !== key);
    save();
    render();
  }

  function render() {
    // Drop anything no longer sold (e.g. after a catalogue change)
    if (products.size) basket = basket.filter(l => products.has(l.id));

    const count = basket.length;
    els.count.textContent = count;
    els.count.hidden = count === 0;
    els.btn.setAttribute('aria-label', `Open basket (${count} item${count === 1 ? '' : 's'})`);

    els.items.textContent = '';
    let oneOff = 0, monthly = 0;
    basket.forEach(({ key, id, details }, i) => {
      const p = products.get(id);
      if (!p) return;
      if (p.interval) monthly += p.amount; else oneOff += p.amount;

      const li = el('li', 'basket-item');
      li.style.setProperty('--i', i);
      li.appendChild(el('div', 'basket-item-name', p.name));
      li.appendChild(el('div', 'basket-item-price', priceLabel(p)));
      const who = [details.business, [details.first_name, details.last_name].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      if (who) li.appendChild(el('div', 'basket-item-meta', 'For ' + who));
      const controls = el('div', 'basket-item-controls');
      const remove = el('button', 'basket-remove', 'Remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${p.name} from basket`);
      remove.addEventListener('click', () => removeLine(key));
      controls.appendChild(remove);
      li.appendChild(controls);
      els.items.appendChild(li);
    });

    const hasItems = products.size > 0 && basket.length > 0;
    els.items.hidden = paying;
    els.empty.hidden = hasItems || paying;
    els.foot.hidden = !hasItems || paying;

    els.totals.textContent = '';
    if (hasItems) {
      const today = el('div', 'total-today');
      today.append(el('span', null, 'Due today'), el('span', null, fmt(oneOff + monthly)));
      els.totals.appendChild(today);
      if (monthly) {
        const sub = el('div', 'total-sub');
        sub.append(el('span', null, 'Then monthly'), el('span', null, fmt(monthly) + '/mo'));
        els.totals.appendChild(sub);
      }
    }
  }

  // ── Drawer ──
  function openDrawer() {
    lastFocus = document.activeElement;
    els.drawer.classList.add('open');
    els.drawer.setAttribute('aria-hidden', 'false');
    els.overlay.hidden = false;
    els.btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('basket-open');
    setTimeout(() => els.close.focus(), 50);
  }

  function closeDrawer() {
    els.drawer.classList.remove('open');
    els.drawer.setAttribute('aria-hidden', 'true');
    els.overlay.hidden = true;
    els.btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('basket-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function showStatus(type, message, target) {
    const box = target || els.status;
    box.className = 'form-status show' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  // ── Checkout (Stripe embedded payment form) ──
  function showPayView() {
    paying = true;
    els.payTotals.textContent = '';
    els.payTotals.append(...Array.from(els.totals.children, n => n.cloneNode(true)));
    els.payStatus.className = 'form-status';
    els.pay.hidden = false;
    render();
  }

  function leavePayView() {
    paying = false;
    if (paymentForm && typeof paymentForm.unmount === 'function') {
      try { paymentForm.unmount(); } catch { /* already gone */ }
    }
    paymentForm = null;
    document.getElementById('checkout-form').textContent = '';
    els.pay.hidden = true;
    render();
  }

  function resetCheckoutButton() {
    els.checkout.disabled = false;
    els.checkout.textContent = 'Checkout securely';
  }

  async function checkout() {
    if (!basket.length) return;
    if (typeof Stripe !== 'function' || !/^pk_(test|live)_[A-Za-z0-9]+$/.test(STRIPE_PUBLISHABLE_KEY)) {
      showStatus('error', 'Online payments are not set up yet. Please send a quote request instead.');
      return;
    }
    els.checkout.disabled = true;
    els.checkout.textContent = 'Loading secure payment form...';
    showStatus('', 'Preparing your secure checkout...');
    try {
      stripeClient = stripeClient || Stripe(STRIPE_PUBLISHABLE_KEY, { betas: ['custom_checkout_payment_form_1'] });

      const clientSecret = fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          items: basket.map(l => ({ id: l.id, qty: 1, details: l.details }))
        })
      }).then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.client_secret !== 'string') throw new Error(data.error || 'Checkout is unavailable right now.');
        return data.client_secret;
      });
      await clientSecret; // surface basket/server errors before switching views

      const checkoutSdk = stripeClient.initCheckoutFormSdk({ clientSecret, appearance: CHECKOUT_APPEARANCE });
      showPayView();
      paymentForm = checkoutSdk.createForm({ layout: 'expanded' });
      paymentForm.mount('#checkout-form');

      const loadActionsResult = await checkoutSdk.loadActions();
      if (loadActionsResult.type !== 'success') throw new Error('The payment form could not be loaded. Please try again.');
      paymentForm.on('confirm', async (event) => {
        els.payStatus.className = 'form-status';
        try {
          // On success Stripe redirects to success.html; the webhook delivers the project details
          const result = await loadActionsResult.actions.confirm({ formConfirmEvent: event });
          if (result && result.type === 'error') {
            showStatus('error', (result.error && result.error.message) || 'Payment failed. Please try again.', els.payStatus);
          }
        } catch (error) {
          console.error('Payment confirmation error:', error);
          showStatus('error', 'Payment could not be completed. Please try again.', els.payStatus);
        }
      });
      setTimeout(() => els.payBack.focus(), 50);
    } catch (err) {
      if (paying) leavePayView();
      showStatus('error', (err && err.message) || 'Checkout is unavailable right now. Please try again.');
    } finally {
      resetCheckoutButton();
    }
  }

  els.btn.addEventListener('click', openDrawer);
  els.close.addEventListener('click', closeDrawer);
  els.overlay.addEventListener('click', closeDrawer);
  els.browse.addEventListener('click', closeDrawer);
  els.checkout.addEventListener('click', checkout);
  els.payBack.addEventListener('click', () => { leavePayView(); els.status.className = 'form-status'; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && els.drawer.classList.contains('open')) closeDrawer();
  });
  // Keep the basket in sync across tabs
  window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) { basket = load(); render(); } });

  // Returning from a cancelled checkout: reopen the basket so nothing is lost
  if (new URLSearchParams(location.search).get('checkout') === 'cancelled') {
    history.replaceState(null, '', location.pathname + location.hash);
    setTimeout(() => {
      openDrawer();
      showStatus('', 'Checkout was cancelled. Your basket has been kept.');
    }, 400);
  }

  window.LSBasket = { add: addItem, open: openDrawer };

  render();
  fetch('products.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(data => {
      products = new Map((data.products || []).map(p => [p.id, p]));
      render();
    })
    .catch(() => {
      showStatus('error', 'Packages could not be loaded, so checkout is unavailable. Please send a quote request instead.');
    });
})();
