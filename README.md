# KisanTractor

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Raju2006-rk/kisan-tractor)

A mobile-first marketplace that connects farmers in Nashik, Maharashtra with nearby tractor owners. Farmers search local tractors, book one for themselves or someone else, and pay the owner **directly**. KisanTractor holds no money and takes no commission.

The product includes a 3D scrolling landing page, OTP login, separate farmer and owner dashboards, tractor listings with equipment and rates, a multi-step booking flow, a full booking lifecycle with work tracking, automatic final billing, owner-marked direct payments, live farmer GPS tracking for the owner, disputes, notifications, and all 22 scheduled Indian languages.

---

## 🚀 Live Deployment Guide

KisanTractor is a **full-stack Next.js 16 application** featuring server-side API routes, dynamic cookies, and backend persistence.

> **Note on GitHub Pages:** GitHub Pages is a static file host (HTML/CSS only) and cannot run Node.js servers or Next.js backend API routes. For free, seamless hosting with 100% full-stack support, deploy to **Vercel** (the creators of Next.js).

### Deploy in 60 Seconds on Vercel (Free)
1. Click the button above or visit [vercel.com](https://vercel.com).
2. Sign in with GitHub and select the **`Raju2006-rk/kisan-tractor`** repository.
3. Click **Deploy**. Vercel will automatically build and launch the live site with working API endpoints and database functionality.

---

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts

| Role | Name | Mobile | Notes |
| --- | --- | --- | --- |
| Farmer | Amit Patil | `9876546312` | Has active and upcoming bookings |
| Owner | Ramesh Shinde | `9876500248` | Owns a Mahindra 575 DI, online |

The demo OTP is always **`123456`**. The auth screen also has one-click demo login buttons.

Demo data is generated relative to the current date and can be restored at any time:

```bash
curl -X POST http://localhost:3000/api/demo/reset
```

or use **Reset demo data** in the app sidebar.

---

## Stack

- **Next.js 16** (App Router, Route Handlers, server components)
- **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Three.js / React Three Fiber / Drei** for the low-poly 3D tractor hero
- **Motion** for scroll and entrance animation
- **Leaflet** for the nearby-tractor map
- **SWR** for client data fetching and revalidation
- **Lucide** icons, **Zod** for validation helpers
- Fonts: Fraunces (display), Manrope (UI), Noto Sans Devanagari (Hindi/Marathi)

---

## What is implemented

### Marketplace and landing
- Animated 3D tractor scene with scroll-linked camera and field.
- Nearby tractors pulled from the real API (not hardcoded cards).
- How it works, services, direct-payment explanation, owner CTA, FAQ.
- **IVR / keypad booking shown as “Coming soon”** — no fake phone number and no non-functional call button.

### Authentication and roles
- Mobile OTP login with server-created sessions (HTTP-only cookie).
- The backend decides farmer vs owner from the user record and redirects to the right dashboard.
- New users can register as a farmer or tractor owner; existing users keep their role.
- Session expiry, logout, and role-based route protection.

### Farmer experience
- Dashboard with nearby tractors, active work, upcoming bookings, and spend/payment summaries.
- Explore with search, service and pricing filters, sorting, list/map toggle, and distance.
- Tractor detail with photos, equipment, rates, owner trust info, and direct-payment notes.
- Multi-step booking wizard: tractor → service/pricing/date/time → location and recipient → review and acknowledgement.
- “Book for someone else” with recipient name and mobile; the recipient does not need an account.
- Booking list with role-aware tabs, counts, search, and inline actions.
- Booking detail with live work record, final bill vs payment received, payment history, owner payment details, dispute panel, and status history.

### Owner experience
- Dashboard with online/offline status, new requests, active jobs, earnings confirmed, and completed work.
- Owner online toggle in the sidebar. Going offline pauses new requests but not accepted work.
- Tractor management: add, edit, remove, photos, equipment, service radius, status, and hourly/per-acre/per-trip rates.
- Direct-payment settings: optional UPI ID, payment QR image, bank details, and preferred method.
- Payment confirmation flow: the owner checks their own UPI app/bank/cash before confirming receipt.

### Booking lifecycle
Backend-enforced statuses:

`PENDING → ACCEPTED → SCHEDULED → IN_PROGRESS ⇄ PAUSED → COMPLETION_PENDING → BILL_GENERATED → PAYMENT_PENDING → PAID → COMPLETED`

Plus `REJECTED`, `CANCELLED_BY_FARMER`, `CANCELLED_BY_OWNER`, `EXPIRED`, and `DISPUTED`.

- Only the owner can accept, reject, start, pause, resume, or finish.
- Only the farmer can create a booking request or share live GPS for it.
- Only the owner can mark a direct payment as done. Farmers pay outside the app and never record a payment in KisanTractor.
- Every transition is validated, written to status history, and produces notifications.
- Farmer-friendly labels are shown in the UI instead of raw status codes.

### Billing and work records
- **Hourly:** active work segments are measured; pauses are recorded separately and not billed.
- **Per acre:** the owner records completed acres at finish.
- **Per trip:** completed trips are recorded at finish.
- The agreed rate is snapshotted onto the booking when it is created.
- The server recalculates the final bill from the recorded work — the client cannot set the amount.
- **Final Bill Amount** and **Payment Received** are always displayed as separate values.
- The owner checks their own UPI app, bank account or cash and taps **Mark payment done**; this creates the confirmed payment record and moves the booking to `PAID` → `COMPLETED`.
- Disputes preserve the original booking, work sessions, bill, and payment records.

### Platform
- English, Hindi, Marathi and all 22 scheduled Indian languages, with a scrollable language switcher, RTL support for Kashmiri/Sindhi/Urdu, persisted preference, and localized status/service labels. Missing translations fall back to English.
- Auto-detect location from the device GPS on the profile screen; the nearest seeded village is selected and the exact coordinates are saved.
- Live farmer GPS sharing on a booking, shown to the tractor owner on a Leaflet map with a **Go to farm land** Google Maps directions link.
- Log out from either the profile screen or the sidebar/bottom navigation.
- Desktop sidebar and mobile bottom navigation.
- Notifications with unread badge and mark-all-read.
- Profile and village/location settings; owner service radius.
- Audit history on every booking.
- Responsive layouts for phones and desktop.

---

## Architecture

```
src/
  app/
    (app)/                 authenticated shell and pages
      dashboard/           role-aware dashboard
      explore/             search + map
      tractors/[id]/       tractor detail
      book/                booking wizard
      bookings/[id]/       booking detail
      owner/tractor/       owner tractor management
      owner/payments/      direct-payment settings
      profile/ help/ notifications/
    api/                   backend route handlers
    auth/                  OTP login
  components/
    app/                   authenticated UI
    marketing/             landing page
    three/                 R3F tractor scene
    ui/                    primitives, logo, photo
  lib/
    booking-service.ts     permissions, transitions, pricing, billing, audit
    auth.ts                sessions and OTP
    db.ts                  JSON store with serialized writes
    seed.ts                demo data
    pricing.ts             shared amount calculations
    constants.ts           services, equipment, villages, status metadata
    i18n.tsx               translations
supabase/
  schema.sql               production schema, RLS, RPCs
```

### Demo backend

Because no Supabase credentials were provided, the demo uses a **server-side JSON store** at `data/db.json`. It is created on first request from `src/lib/seed.ts` and written through a serialized mutation queue.

Important: this is a real server backend, not `localStorage`. The browser never owns bookings, prices, statuses, or payments. All mutations go through `/api/*`, and the server remains authoritative. The JSON store is intended for demo/local use; `supabase/schema.sql` is the production path.

### API surface

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/request-otp` | Create an OTP challenge |
| POST | `/api/auth/verify-otp` | Verify OTP, create session |
| POST | `/api/auth/demo` | One-click demo login |
| POST | `/api/auth/logout` | Destroy session |
| GET | `/api/auth/me` | Current session user |
| GET | `/api/tractors` | Search nearby tractors (`owner=me` for own listings) |
| POST | `/api/tractors` | Create an owner listing |
| GET/PATCH/DELETE | `/api/tractors/[id]` | Detail, edit, remove |
| GET/POST | `/api/bookings` | List / create bookings |
| GET | `/api/bookings/[id]` | Booking detail |
| POST | `/api/bookings/[id]/actions` | Lifecycle actions |
| PATCH | `/api/owner/status` | Online/offline |
| PATCH | `/api/owner/payments` | Direct-payment details |
| GET | `/api/owner/dashboard` | Owner stats |
| PATCH | `/api/profile` | Name, village, address, service radius |
| GET/PATCH | `/api/notifications` | List / mark read |
| POST | `/api/upload` | Tractor and payment QR images |
| POST | `/api/demo/reset` | Restore seed data |

Booking actions accepted by `/api/bookings/[id]/actions`:

`accept`, `reject`, `cancel`, `start`, `pause`, `resume`, `finish`, `confirm_payment` (owner "Mark payment done"), `share_location` (farmer live GPS), `dispute`. `record_payment` is retained only as a deprecated 403 response.

---

## Connecting Supabase

1. Create a Supabase project.
2. Enable phone/OTP auth (or keep the app’s OTP flow and store users in `profiles`).
3. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
5. Replace the JSON store calls in `src/lib/booking-service.ts` with Supabase queries/RPCs. The SQL file already defines the booking RPCs, row-level security, constraints, and audit triggers that mirror the demo logic.

The schema enforces the same rules as the demo:

- Only farmers can create bookings; only the tractor owner can respond or run work.
- A booking is blocked when the tractor already has an overlapping active booking.
- Pricing must be enabled for the chosen tractor and pricing type.
- The final bill is calculated by SQL from recorded work, never supplied by the client.
- Payment confirmation is owner-only: the owner taps **Mark payment done**, which creates/confirms the record. Farmers cannot record a payment.
- Live GPS can be shared only by the farmer, only for an accepted or active booking, and can be stopped at any time.
- Payment details are visible only to a farmer with an accepted-or-later booking with that owner.
- Disputes keep the original records intact.

### Production hardening checklist

- Use a real OTP/SMS provider and rate-limit OTP requests.
- Add CSRF protection and request throttling to mutating routes.
- Move uploads to Supabase Storage with signed URLs and image scanning.
- Add database backups, monitoring, and error reporting.
- Serve over HTTPS; keep `secure` cookies enabled (already the default in production).
- Remove or disable `/api/demo/reset` (`ALLOW_DEMO_RESET` stays false).

---

## Payments and safety

- **No Razorpay, Stripe, or any payment gateway is integrated.**
- The farmer pays the tractor owner directly by UPI, cash, bank transfer, or another agreed method.
- KisanTractor does not collect, hold, route, or process money, and takes no commission.
- The app never asks for bank OTPs, UPI PINs, card PINs, or passwords, and never stores them.
- Owner payment details are optional and shown only to a farmer with an accepted booking.
- “Final Bill Amount” (what is owed) and “Payment Received” (owner-confirmed) are clearly separated everywhere.

---

## IVR / keypad booking

IVR booking is **coming soon**. There is no working phone number and no fake call button. The landing page and Help page explain the status honestly and point farmers to the app in the meantime.

---

## Scripts

```bash
npm run dev      # development server
npm run build    # production build + type check
npm run start    # run the production build
npm run lint     # ESLint
```

Type check only:

```bash
node node_modules/typescript/bin/tsc --noEmit
```
