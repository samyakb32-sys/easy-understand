# EasyUnderstand 製図

Upload an Engineering Graphics & Design (EGD) problem, watch it drawn step by step like a professor teaching, then explore the solid in 3D.

## Run

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY to enable photo upload solving
npm run dev                  # http://localhost:3000
npm test                     # geometry + schema tests
```

The example lessons (`/solve/line-projection`, `pentagon`, `cylinder-development`, `prism-views`, `isometric-prism`, `isometric-cylinder`, `section-pyramid`, `section-prism`, `section-cylinder`) work without any API key.

## How it works

1. `/api/solve` sends the photo or text to Claude, which only **classifies** the problem and reads the numbers.
2. `lib/geometry/solvers.ts` **calculates** the drawing as a `Solution` (steps, line coordinates, optional 3D solid). Impossible inputs are rejected, not guessed.
3. `components/StepPlayer.tsx` animates the steps; `components/Solid3DViewer.tsx` shows the 3D model.

Adding a new problem type = add a template in `solvers.ts` and describe it in the prompt in `app/api/solve/route.ts`.

## Accounts and payments setup

Sign-in and the database use **Supabase**; payments use **Razorpay**. Nothing here works until you create both accounts and fill in `.env.local` (see `.env.example`). Until then the site still runs: examples work, and the sign-in and buy buttons explain that they are not set up.

### 1. Supabase (sign-in + database)
1. Create a project at supabase.com. Copy the project URL and the `anon` key, and the `service_role` key (server only, never `NEXT_PUBLIC_`).
2. In the SQL editor, run `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_atomic_order.sql`, then `supabase/migrations/0003_solve_misses.sql`.
3. Authentication > Providers: enable **Email** (magic link) and **Google** (create OAuth credentials in Google Cloud and paste the client id/secret).
4. Authentication > URL Configuration: set the Site URL to your domain and add `https://YOUR-DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback` for local work) to the redirect URLs.

### 2. Razorpay (payments)
1. Create an account and use **Test mode** first. Copy the key id and key secret.
2. Subscriptions > Plans: create a **monthly** and a **yearly** plan. The amounts must equal `PAID_PLANS.pro_monthly.amountPaise` and `pro_yearly.amountPaise` in `lib/pricing.ts` (defaults ₹199 and ₹1,499). Checkout refuses to start if they differ. Put the two plan ids in `RAZORPAY_PLAN_MONTHLY` / `RAZORPAY_PLAN_YEARLY`.
3. Settings > Webhooks: add `https://YOUR-DOMAIN/api/razorpay/webhook`, choose a secret (put it in `RAZORPAY_WEBHOOK_SECRET`) and tick: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted`, `subscription.completed`, `subscription.paused`, `subscription.pending`, `subscription.resumed`, `order.paid`. For local testing expose your dev server with a tunnel (for example ngrok).
4. Test with Razorpay's test cards/UPI before going live.

### How it works
- Pro is simply `entitlements.pro_until` being in the future. Subscription payments and the Exam pack only ever move that date forward, so a cancelled subscription keeps working to the end of the paid period and then lapses on its own.
- Prices come from `lib/pricing.ts` on the server; the browser cannot choose an amount.
- After Checkout the browser calls `/api/checkout/verify` (checks the payment signature and that the payment belongs to that student). The **webhook is the source of truth** for renewals, and both paths are idempotent, so retries or double delivery never double-count.
- AI solves need a signed-in student and are counted per day in India time (`FREE_DAILY_SOLVES`, `PRO_DAILY_SOLVES` in `lib/pricing.ts`). A solve is refunded in full when the failure is ours (Anthropic or network trouble, a timeout). When the AI cannot read the problem or says it is unsupported, the model call was still paid for, so those are refunded only for the first 5 misses a day (`MISS_REFUNDS_PER_DAY` in `app/api/solve/route.ts`).
- Everything is tested with `npm test`: signatures, webhook handling, idempotency, checkout/verify, entitlements.

### Before you take real money
- The prices in `lib/pricing.ts` are defaults, not a decision.
- `/legal/*` pages (terms, privacy, refunds, contact) are **drafts with placeholders**. Razorpay's live activation reviews them, so fill in your business details and have them checked.
- Complete Razorpay KYC, switch to live keys and live plan ids, and re-add the webhook in live mode.
- The 3D lock hides a feature that is also present in the public example pages; it protects the paid AI features and history, not the sample code. That is a deliberate trade-off for a teaching site.

## Not done yet

Refund/invoice tooling (refunds are done from the Razorpay dashboard), an admin view, GST invoices, the OpenCV/OCR pre-processing step, and some problem types (solids tilted to the VP first; isometric of solids that are side by side or have holes; interpenetration of anything other than two cylinders at right angles).
