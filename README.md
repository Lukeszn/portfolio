# Luke Studio

The source code for my website, showcasing web design and development services for small businesses. The site includes a product catalogue, basket, and embedded Stripe Checkout, with server-side checkout and webhook handling in Netlify Functions.

## Tech stack

- Static HTML, CSS, and browser JavaScript
- Netlify Functions (Node.js) for Stripe Checkout and webhook events
- Stripe for payments

## Run locally

Requirements: Node.js 20 or later and the Netlify CLI.

```sh
npm install
npx netlify-cli dev
```

For local checkout and webhook testing, configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in your local environment. Keep these values private; never commit them. The site can be browsed locally without payment credentials, but checkout will not be available.

## Deploy

Connect this repository to Netlify. The build and functions settings are defined in `netlify.toml`; the site is published from the repository root. Set these environment variables in the Netlify site configuration:

- `STRIPE_SECRET_KEY` — Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` — signing secret for the Stripe webhook endpoint

Configure the Stripe webhook to call `/.netlify/functions/stripe-webhook` on your deployed site. The webhook handles checkout completion and relevant payment and subscription events. Product IDs and displayed prices are in `products.json`; the matching active products and prices must also be configured in Stripe.

## Project structure

- `index.html` — main portfolio and services page
- `css/` and `js/` — site styles and client-side behavior
- `products.json` — product catalogue used by the site and checkout function
- `netlify/functions/` — Stripe Checkout and webhook handlers
- `privacy.html`, `terms.html`, `success.html`, `404.html` — supporting pages
- `netlify.toml` — Netlify build, function, redirect, and response-header configuration
