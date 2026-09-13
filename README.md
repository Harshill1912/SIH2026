# e-Metrology

**Online verification and digital certification for weights and measuring instruments used
in trade.**

Smart India Hackathon 2026 · Problem Statement **SIH26036** · Ministry of Consumer Affairs,
Food & Public Distribution.

Under the Legal Metrology Act, 2009, every scale, weighbridge and fuel dispenser used in
trade must be verified and stamped before use, and re-verified periodically. That process is
still largely manual. e-Metrology takes it end to end — application, dispatch, on-site
inspection, certificate — and ends it somewhere new: a QR sticker that **any shopper can
verify in about a second, with no account and no app**.

---

## What makes it different

- **The certificate is the QR.** It carries an HMAC-SHA256 signature over its own contents,
  so verification recomputes the signature rather than looking anything up. Edit the
  capacity or the trader name and the signature stops matching.
- **The PASS/FAIL is computed, not typed.** The officer records standard weights and what
  the instrument displayed; the server derives the error, the Maximum Permissible Error
  under OIML R76, and the verdict — then signs it into the certificate.
- **Two verification tracks.** Work is dispatched to a departmental officer *or* to a
  notified Government Approved Test Centre, as the rules actually allow.
- **Built for the field.** Inspections queue on the device with photograph and geotag when
  there is no signal, and flush when it returns.
- **Enforcement intelligence, kept out of the verdict.** HQ sees every instrument ranked by
  risk of failing — drift toward its limit, lapsed validity, complaints — and inspections
  flagged for a second look: a geotag far from the shop, a reused seal photo, readings too
  perfect to be real. Advisory only; every score shows its reasons.
- **The public can push back.** Anyone can report a missing or lapsed sticker without an
  account; reports land in an enforcement queue at HQ.

---

## Running it

```bash
npm install
npx prisma db push      # create the SQLite database from the schema
npx prisma db seed      # load the demo dataset
npm run dev             # http://localhost:3000
npm test                # 35 unit tests: MPE engine, certificate signing, rate limits, risk engine
```

### Demo accounts

Password for all four: `demo1234` — or click a card on the sign-in page.

| Role | Email |
|---|---|
| Business owner | `owner@abctraders.in` |
| Admin HQ | `admin@metrology.gov.in` |
| Field officer (LMO) | `rajesh.kumar@metrology.gov.in` |
| Test centre (GATC) | `verify@precisiontestlabs.in` |

The public verification page needs no sign-in: **/verify**

### A five-minute walkthrough

1. **Business** — register an instrument, then apply for verification.
2. **Admin HQ** — assign an officer or a test centre and pick a visit date and slot.
3. **Field officer** — open the case, allow location (or use the shop location), attach a
   photograph, enter the standard-weight readings, and submit. Watch the verdict compute.
4. **Certificate** — print the sticker sheet from the dialog that appears.
5. **Public** — open `/verify`, scan the printed sticker, and see it verified. Try the
   Tampered sample to see a failed signature.

**Reset demo** in the header returns the database to its seeded state at any time.

---

## Project layout

```
prisma/schema.prisma        data model, single source of truth
src/proxy.ts                auth gate — runs before every route
src/lib/
  auth.ts                   sessions, password hashing, route guards
  mpe.ts                    OIML R76 Maximum Permissible Error engine
  risk.ts                   risk-of-failure score and inspection integrity flags (advisory)
  alerts.ts                 expiry buckets and reminder copy
  schedule.ts               visit dates and half-day slots
  seed-data.ts              the demo dataset, shared by seed and reset
src/app/
  page.tsx                  role-routed dashboard
  verify/                   public verification portal and certificate page
  sticker/[token]/          printable sticker sheet
  search/                   jurisdiction-wide search
  api/                      route handlers
src/components/             UI, grouped by the role that uses it
docs/ARCHITECTURE.md        architecture, security framework, deployment
```

---

## Stack

Next.js 16 (App Router, React 19) · TypeScript · Tailwind CSS v4 · Prisma ORM · SQLite in
development, PostgreSQL in production · Node `crypto` (scrypt) · `jsonwebtoken` (HMAC-SHA256)
· `qrcode` · browser Geolocation, Camera and `BarcodeDetector` · installable PWA.

No external service sits on the verification path. A consumer checking a sticker touches
this application and nothing else.

---

## Documentation

**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the architecture, the certificate design,
the security framework including what is deliberately *not* implemented, and the deployment
methodology.
