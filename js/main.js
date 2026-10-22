document.documentElement.classList.add('js');

// Nav border once the hero has scrolled away (IntersectionObserver, no scroll listener)
const nav = document.getElementById('nav');
const hero = document.getElementById('hero');
if (nav && hero) {
  new IntersectionObserver(([entry]) => {
    nav.classList.toggle('scrolled', !entry.isIntersecting);
  }, { rootMargin: '-80px 0px 0px 0px' }).observe(hero);
}

// Highlight the nav link for the section in view
const navLinks = new Map(
  [...document.querySelectorAll('.nav-links a[href^="#"]')].map(a => [a.getAttribute('href').slice(1), a])
);
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const link = navLinks.get(entry.target.id);
    if (link && !link.classList.contains('nav-cta')) link.classList.toggle('current', entry.isIntersecting);
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach((_, id) => { const s = document.getElementById(id); if (s) sectionObserver.observe(s); });

// Mobile menu
const menuBtn = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileClose = document.getElementById('mobileClose');

menuBtn.addEventListener('click', () => {
  mobileMenu.classList.contains('open') ? closeMobile() : mobileMenu.classList.add('open');
});
mobileClose.addEventListener('click', closeMobile);
document.querySelectorAll('.mobile-menu a').forEach(a => a.addEventListener('click', closeMobile));
function closeMobile() { mobileMenu.classList.remove('open'); }

// Make project cards tappable while preserving inner links/buttons.
document.querySelectorAll('.project-card').forEach(card => {
  const link = card.querySelector('.project-link');
  if (!link) return;
  card.addEventListener('click', event => {
    if (event.target.closest('a, button, input, select, textarea, label')) return;
    window.open(link.href, link.target || '_self', link.target === '_blank' ? 'noopener' : undefined);
  });
});

// Mobile app preview carousel
(function () {
  const apps = [
    {
      title: 'New Era Web App',
      copy: 'Dashboard-style app experience with live data, responsive screens, and a polished mobile view.',
      href: 'https://lukeszn.github.io/New-Era-App/',
      screenshot: 'images/new-era-phone.webp',
      alt: 'New Era App main page preview'
    },
    {
      title: 'Naomi Web App',
      copy: 'A clean, user-friendly product interface shaped around simple navigation and practical everyday workflows.',
      href: 'https://lukeszn.github.io/Naomi-app/',
      screenshot: 'images/naomi-phone.webp',
      alt: 'Naomi App main page preview'
    }
  ];

  const screen = document.querySelector('.phone-screen');
  const screenshot = document.getElementById('phoneScreenshot');
  const title = document.getElementById('phoneMetaTitle');
  const copy = document.getElementById('phoneMetaCopy');
  const link = document.getElementById('phoneLiveLink');
  const dots = document.getElementById('phoneDots');
  const prev = document.getElementById('phonePrev');
  const next = document.getElementById('phoneNext');
  if (!screen || !screenshot || !title || !copy || !link || !dots || !prev || !next) return;

  let current = 0;
  apps.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'phone-dot';
    dot.type = 'button';
    dot.setAttribute('aria-label', 'Show app preview ' + (i + 1));
    dot.addEventListener('click', () => showApp(i));
    dots.appendChild(dot);
  });

  function showApp(index) {
    current = (index + apps.length) % apps.length;
    const app = apps[current];
    screen.classList.add('loading');
    setTimeout(() => {
      screenshot.src = app.screenshot;
      screenshot.alt = app.alt;
      title.textContent = app.title;
      copy.textContent = app.copy;
      link.href = app.href;
      dots.querySelectorAll('.phone-dot').forEach((dot, i) => dot.classList.toggle('active', i === current));
      screen.classList.remove('loading');
    }, 150);
  }

  prev.addEventListener('click', () => showApp(current - 1));
  next.addEventListener('click', () => showApp(current + 1));
  showApp(0);
})();

// ─── Project form: website packages and AI plans go to the basket, everything else is a quote ───
const quoteForm = document.querySelector('.contact-form');
const formSubmit = document.getElementById('formSubmit');
const formHint = document.getElementById('formHint');
const quoteStatus = document.getElementById('quoteStatus');

function activeBlock() {
  return document.querySelector('.service-detail-block.active');
}

// The checked package option in the open detail block, if it can be bought online
function selectedProduct() {
  const block = activeBlock();
  const option = block && block.querySelector('input[data-product]:checked');
  if (!option) return null;
  const card = option.closest('.tier-card');
  return {
    id: option.dataset.product,
    price: card ? card.querySelector('.tier-price').textContent.replace(/\s+/g, ' ').trim() : ''
  };
}

function updateFormMode() {
  const service = quoteForm.querySelector('input[name="service"]:checked');
  const product = selectedProduct();
  if (product) {
    formSubmit.textContent = 'Add to basket, ' + product.price;
    formHint.textContent = 'You pay at checkout. Your project details are sent to me as soon as payment goes through.';
  } else {
    formSubmit.textContent = 'Send quote request';
    formHint.textContent = service
      ? "I'll reply within 24 hours with a price and next steps."
      : 'Choose a service to continue.';
  }
}

// Only the open detail block takes part in validation and submission
function showServiceDetail(value) {
  document.querySelectorAll('.service-detail-block').forEach(block => {
    const active = block.id === 'detail-' + value;
    block.classList.toggle('active', active);
    block.querySelectorAll('input, select, textarea').forEach(control => { control.disabled = !active; });
  });
  syncPhoneField();
  updateFormMode();
}

function syncPhoneField() {
  const field = document.getElementById('ai-phone-field');
  if (!field) return;
  const choice = quoteForm.querySelector('input[name="ai_contact"]:checked');
  const show = !!choice && !choice.disabled && (choice.value === 'Phone' || choice.value === 'WhatsApp');
  field.hidden = !show;
  field.querySelectorAll('input').forEach(input => { input.disabled = !show; });
}

function fieldNameFromLabel(control, index) {
  const group = control.closest('.form-group');
  const groupLabel = group ? group.querySelector(':scope > label, :scope > legend') : null;
  const label = groupLabel || control.closest('label');
  const base = label ? label.textContent : control.placeholder || ('field_' + index);
  return base
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || ('field_' + index);
}

// Give unnamed detail fields a readable name taken from their label
function nameDetailFields(form) {
  form.querySelectorAll('input, select, textarea').forEach((control, index) => {
    if (control.name || control.type === 'submit' || control.type === 'button') return;
    control.name = fieldNameFromLabel(control, index);
  });
}

const SERVICE_NAMES = {
  websites: 'Website',
  ai: 'AI Receptionist',
  app: 'App Development',
  automation: 'Data Automation',
  other: 'Other'
};

function formPayload(form) {
  nameDetailFields(form);
  const payload = {};
  new FormData(form).forEach((value, key) => {
    value = String(value).trim();
    if (!value) return;
    payload[key] = payload[key] ? payload[key] + ', ' + value : value;
  });
  if (payload.service) payload.service = SERVICE_NAMES[payload.service] || payload.service;
  payload.message = detailsText(payload);
  return payload;
}

function detailsText(payload) {
  return Object.keys(payload)
    .filter(key => !['form-name', 'bot-field', 'subject', 'message'].includes(key))
    .map(key => key.replace(/_/g, ' ') + ': ' + payload[key])
    .join('\n');
}

function mailtoFromPayload(payload) {
  const subject = payload.subject || 'New quote request from Luke Studio website';
  return 'mailto:lukeszns@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(payload.message || '');
}

function showFormStatus(status, type, message) {
  if (!status) return;
  status.className = 'form-status show' + (type ? ' ' + type : '');
  status.textContent = message;
}

function resetProjectForm() {
  quoteForm.reset();
  showServiceDetail('');
}

function addToBasket(product, payload) {
  if (!window.LSBasket) {
    showFormStatus(quoteStatus, 'error', 'The basket could not load. Please refresh the page and try again.');
    return;
  }
  const result = window.LSBasket.add(product.id, {
    first_name: payload.first_name || '',
    last_name: payload.last_name || '',
    email: payload.email || '',
    business: payload.business_name || payload.app_name_or_concept || '',
    message: payload.message
  });
  if (!result.ok) {
    showFormStatus(quoteStatus, 'error', result.error);
    return;
  }
  resetProjectForm();
  showFormStatus(quoteStatus, 'success', result.replaced
    ? 'Your basket already had this plan, so it has been updated with these details.'
    : 'Added to your basket. Check out when you are ready, and your details will be sent to me once payment goes through.');
  window.LSBasket.open();
}

async function sendQuote(form, payload) {
  formSubmit.disabled = true;
  formSubmit.textContent = 'Sending...';
  showFormStatus(quoteStatus, '', 'Sending your quote request...');
  try {
    const body = new URLSearchParams();
    body.set('form-name', 'quote-request');
    body.set('subject', payload.subject || 'New quote request from Luke Studio website');
    body.set('first_name', payload.first_name || '');
    body.set('last_name', payload.last_name || '');
    body.set('email', payload.email || '');
    body.set('service', payload.service || '');
    body.set('message', payload.message || '');
    body.set('bot-field', payload['bot-field'] || '');

    const response = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (!response.ok) throw new Error('Quote request failed.');
    resetProjectForm();
    showFormStatus(quoteStatus, 'success', 'Thanks, your quote request has been sent. I will get back to you within 24 hours.');
  } catch (error) {
    showFormStatus(quoteStatus, 'error', 'The quote could not be sent automatically. Please ');
    const link = document.createElement('a');
    link.href = mailtoFromPayload(payload);
    link.textContent = 'send it by email instead';
    quoteStatus.append(link, '.');
  } finally {
    formSubmit.disabled = false;
    updateFormMode();
  }
}

if (quoteForm) {
  quoteForm.addEventListener('change', event => {
    if (event.target.name === 'service') showServiceDetail(event.target.value);
    else if (event.target.name === 'ai_contact') syncPhoneField();
    else updateFormMode();
  });

  // The browser has already checked required fields (name, email, service, package) by now
  quoteForm.addEventListener('submit', event => {
    event.preventDefault();
    const payload = formPayload(quoteForm);
    const product = selectedProduct();
    if (product) addToBasket(product, payload);
    else sendQuote(quoteForm, payload);
  });

  showServiceDetail('');
}

// "Choose a package" / "Request a quote" buttons: jump to the form with that service picked
function scrollToEl(target) {
  const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
  const top = target.getBoundingClientRect().top + window.pageYOffset - navH;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

document.querySelectorAll('[data-quote-service]').forEach(button => {
  button.addEventListener('click', event => {
    event.preventDefault();
    const service = button.dataset.quoteService;
    const radio = quoteForm && quoteForm.querySelector(`input[name="service"][value="${service}"]`);
    if (radio) {
      radio.checked = true;
      showServiceDetail(service);
    }
    scrollToEl(document.getElementById('contact'));
  });
});

// Smooth scroll for anchor links (nav-offset aware, iOS compatible)
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      scrollToEl(target);
    }
  });
});

// ─── CHATBOT ───
(function () {
  const widget   = document.getElementById('chatWidget');
  const toggle   = document.getElementById('chatToggle');
  const helpBtn  = document.getElementById('chatHelp');
  const msgs     = document.getElementById('chatMessages');
  const qrArea   = document.getElementById('chatQR');
  const input    = document.getElementById('chatInput');
  const sendBtn  = document.getElementById('chatSend');
  const minBtn   = document.getElementById('chatMinimize');
  let started    = false;

  const KB = [
    {
      keys: ['hello','hi','hey','sup','good morning','good afternoon','good evening','start'],
      reply: "Hi, I'm the Luke Studio assistant.\n\nI can tell you about services, prices and timelines, or help you start a project. What are you looking for?",
      qr: ['Services', 'AI Receptionist', 'Pricing', 'Start a project']
    },
    {
      keys: ['service','what do you','what can you','what you do','offer','help me with','options'],
      reply: "Here's what I build:\n\n**Websites**: fast, modern sites that turn visitors into customers\n**App Development**: web and mobile apps built to scale\n**AI Receptionist**: answers calls and chats 24/7 and books appointments\n**Data Automation**: workflows, pipelines and integrations\n\nWhich one interests you?",
      qr: ['Websites', 'App Development', 'AI Receptionist', 'Data Automation']
    },
    {
      keys: ['website','web design','landing page','redesign','web development'],
      reply: "Websites are the core of what I do.\n\nThere are two fixed-price packages you can buy online:\n• **Simple Website**, £200 one-off\n• **Complex Website**, £500 one-off, adds payments, bookings and accounts\n\nBigger builds get a custom quote.",
      qr: ['Start a project', 'Timeline', 'See projects']
    },
    {
      keys: ['app','mobile app','web app','application','software','build an app'],
      reply: "I build apps from MVPs to full platforms with React, Next.js and modern stacks, with clean code that grows with your business.\n\nApps are priced per project, so send a quote request with your idea.",
      qr: ['Start a project', 'Pricing', 'Timeline', 'See projects']
    },
    {
      keys: ['ai','artificial intelligence','chatbot','receptionist','ai receptionist','phone','booking','call','never miss','machine learning','smart'],
      reply: "The AI Receptionist:\n\n• **Answers your phone 24/7**, so you never miss a lead\n• **Handles website chat** and qualifies enquiries\n• **Takes bookings** automatically\n• **Dashboard** of every call, chat and booking\n\nPlans start at £40/month (Starter), then £97 (Growth) and £197 (Professional). You can buy a plan online and cancel any time.",
      qr: ['Start a project', 'Pricing']
    },
    {
      keys: ['data','automation','workflow','pipeline','integration','connect tools','automate'],
      reply: "Data automation means:\n• Automating repetitive tasks\n• Connecting your tools (CRM, Sheets, APIs)\n• Real-time dashboards\n• Data pipelines that run on their own\n\nIt's priced per project, so send a quote request describing the workflow.",
      qr: ['Start a project', 'Pricing', 'Contact']
    },
    {
      keys: ['price','pricing','cost','how much','rate','budget','charge','fee'],
      reply: "Fixed prices you can pay online:\n• Simple Website: £200\n• Complex Website: £500\n• AI Receptionist: £40, £97 or £197 per month\n\nApps, automation and bigger builds get a custom quote, usually £200 to £2,000.",
      qr: ['Start a project', 'Contact info']
    },
    {
      keys: ['pay','payment','checkout','basket','card','apple pay','google pay'],
      reply: "Choose a website package or AI plan in the project form, fill in your details and add it to your basket. You pay by card, Apple Pay, Google Pay or bank through Stripe, and your details are sent to me once payment goes through.",
      qr: ['Start a project', 'Pricing']
    },
    {
      keys: ['timeline','how long','turnaround','deadline','fast','quick','rush','time'],
      reply: "Typical timelines:\n\n• Landing page: 3 to 5 days\n• Full website: 1 to 3 weeks\n• Web app: 3 to 8 weeks\n• AI integration: 1 to 4 weeks\n• Automation setup: 1 to 2 weeks\n\nIf it's urgent, mention it in the form.",
      qr: ['Start a project']
    },
    {
      keys: ['process','how does it work','steps','what happens','how do you work'],
      reply: "Every project follows the same process:\n\n**Discovery**: goals, audience and timeline\n**Design**: wireframes and page designs for you to review\n**Build**: clean, fast, tested code\n**Launch**: go live, plus 30 days of support",
      qr: ['Start a project', 'Pricing']
    },
    {
      keys: ['contact','email','reach','talk','speak','message','get in touch'],
      reply: "You can reach Luke directly:\n\nPhone / WhatsApp: 07851 950009\nEmail: lukeszns@gmail.com\nReplies within 24 hours.\n\nOr use the project form further down the page.",
      qr: ['Start a project', 'Email directly']
    },
    {
      keys: ['book','meeting','schedule','consultation','free call','discovery'],
      reply: "A discovery call is the first step of every project. Email lukeszns@gmail.com with times that suit you, or mention it in the project form, and Luke will reply within 24 hours.",
      qr: ['Start a project', 'Email directly']
    },
    {
      keys: ['project','work','portfolio','example','past','case study','previous','show me'],
      reply: "The Work section on this page has live projects you can open, including the New Era and Naomi web apps.",
      qr: ['See projects', 'Services', 'Pricing']
    },
    {
      keys: ['about','who are you','who is luke','experience','background','tell me about'],
      reply: "Luke is a web designer and developer with 5+ years of experience building sites that perform, not just look good.\n\nHe has worked with startups, local businesses and growing brands.",
      qr: ['Services', 'See projects', 'Start a project']
    },
    {
      keys: ['thanks','thank you','great','awesome','perfect','nice','cool','love it'],
      reply: "Happy to help. Anything else you'd like to know?",
      qr: ['Services', 'Start a project', 'Contact info']
    },
    {
      keys: ['bye','goodbye','see you','later','done','no thanks','that\'s all'],
      reply: "Thanks for stopping by. If you want to talk about a project, the form is always here.",
      qr: []
    }
  ];

  function findIntent(text) {
    const lower = text.toLowerCase();
    for (const intent of KB) {
      if (intent.keys.some(k => lower.includes(k))) return intent;
    }
    return null;
  }

  function md(text) {
    // Escape first: user-typed messages are rendered through this too
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  function addMsg(text, side) {
    const wrap = document.createElement('div');
    wrap.className = `chat-msg ${side}`;
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = md(text);
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'typing-wrap';
    wrap.id = 'typingRow';
    const bubble = document.createElement('div');
    bubble.className = 'typing-bubble';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('typingRow');
    if (t) t.remove();
  }

  function setQR(items) {
    qrArea.innerHTML = '';
    items.forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'qr-btn';
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => send(label));
      qrArea.appendChild(btn);
    });
  }

  function botReply(intent) {
    showTyping();
    const delay = 500 + Math.min(intent.reply.length * 3, 700);
    setTimeout(() => {
      removeTyping();
      addMsg(intent.reply, 'bot');
      setQR(intent.qr || []);
    }, delay);
  }

  function send(text) {
    text = text.trim();
    if (!text) return;
    qrArea.innerHTML = '';
    addMsg(text, 'user');
    input.value = '';

    const lower = text.toLowerCase();
    if (lower === 'start a project' || lower === 'contact info' || lower === 'contact') {
      setTimeout(() => scrollToEl(document.getElementById('contact')), 400);
    }
    if (lower === 'email directly') {
      setTimeout(() => { window.location.href = 'mailto:lukeszns@gmail.com'; }, 300);
    }
    if (lower === 'see projects') {
      setTimeout(() => scrollToEl(document.getElementById('work')), 400);
    }

    const intent = findIntent(text);
    if (intent) {
      botReply(intent);
    } else {
      showTyping();
      setTimeout(() => {
        removeTyping();
        addMsg("I don't have an answer for that one. Email lukeszns@gmail.com and Luke will reply within 24 hours.", 'bot');
        setQR(['Services', 'Pricing', 'Start a project', 'Contact info']);
      }, 700);
    }
  }

  function openChat() {
    const open = widget.classList.toggle('open');
    toggle.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    if (open && !started) {
      started = true;
      setTimeout(() => {
        addMsg("Hi, welcome to Luke Studio.\n\nI can answer questions about services, prices, payment and timelines. What would you like to know?", 'bot');
        setQR(['Services', 'AI Receptionist', 'Pricing', 'Start a project']);
      }, 250);
    }
    if (open) setTimeout(() => input.focus(), 300);
  }

  toggle.addEventListener('click', openChat);
  helpBtn.addEventListener('click', openChat);

  minBtn.addEventListener('click', () => { widget.classList.remove('open'); toggle.setAttribute('aria-label', 'Open chat'); });
  sendBtn.addEventListener('click', () => send(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(input.value); });
})();

// Hide project screenshots that fail to load (the grey frame stays)
document.querySelectorAll('img.preview-screenshot, img.phone-screenshot').forEach(img => {
  img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
});
