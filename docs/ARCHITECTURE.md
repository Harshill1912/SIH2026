# e-Metrology — Software Architecture, Security Framework and Deployment

**Problem Statement SIH26036** — Development of an Online Verification System for Weighing
and Measuring Instruments
**Organisation** — Ministry of Consumer Affairs, Food & Public Distribution, Department of
Consumer Affairs

This document describes what the system is, how it is put together, how it is secured, and
how it would be deployed. It is written to be read alongside the running prototype.

---

## 1. The problem, stated precisely

Under the **Legal Metrology Act, 2009** and the **Legal Metrology (General) Rules, 2011**,
every weighing or measuring instrument used in trade must be verified and stamped before use
and re-verified periodically. Today that process is largely manual: applications on paper,
scheduling by telephone, observations in a physical register, a certificate issued days or
weeks later, and expiry tracked by the trader alone.

Three failures follow, and the design targets each one directly.

| Failure | Consequence | What this system does |
|---|---|---|
| Status is invisible to the applicant | Repeated calls to the office; no accountability for delay | Application state and the scheduled visit are visible to the trader from the moment they apply |
| A paper certificate cannot be checked by a consumer | Short weight goes undetected at the counter | The certificate *is* a signed token inside a QR sticker; anyone can verify it without an account |
| Re-verification is missed until an inspection finds it | Traders fall out of compliance unknowingly | Automated reminders at 30, 15 and 7 days, and on expiry |

---

## 2. Stakeholders and roles

Four roles, matching the statute rather than the software.

| Role | Who | Owns |
|---|---|---|
| `BUSINESS` | User of weights and measures | Registering instruments, applying for verification and re-verification |
| `ADMIN` | Legal Metrology HQ / Controller | Dispatching work, monitoring pendency, acting on citizen reports |
| `OFFICER` | Legal Metrology Officer (LMO) | On-site verification and certificate issuance |
| `GATC` | Government Approved Test Centre | The same verification work, as a notified second track |

A fifth actor, **the public**, has no account by design. A shopper standing at a counter will
never have one, so every consumer-facing capability — verification and reporting — works
anonymously.

---

## 3. The workflow

```
BUSINESS          1. Register instrument ──► 2. Apply for verification
                                                        │
ADMIN (HQ)                                  3. Assign officer or GATC + schedule a visit
                                                        │
OFFICER / GATC                              4. On-site inspection ──► 5. Issue signed certificate
                                               (GPS, photo, test weights)          │
PUBLIC                                                              6. Scan the QR and verify
```

Each numbered step maps to a screen in the running application. Steps 4 and 5 are a single
form submission: recording the inspection is what mints the certificate.

---

## 4. System architecture

Three tiers, with an authorisation gate between the first and second.

```
┌── PRESENTATION ─ responsive web + installable PWA ──────────────────────────┐
│  Business portal   │   HQ desk   │   Field app (offline)  │  Public QR page │
└─────────┬───────────────┬────────────────┬────────────────────────┬─────────┘
          ▼               ▼                ▼                        ▼
┌── PROXY ─ session verification → role gate → route ────────────────────────┐
└─────────┬──────────────────────────────────────────────────────────────────┘
          ▼
┌── APPLICATION ─ Next.js route handlers, Node runtime ──────────────────────┐
│  Registration &   │  Scheduling &  │  Inspection +   │  Certificate        │
│  application      │  dispatch      │  MPE engine     │  signer             │
│  Alerts &         │  Search &      │  Reports        │                     │
│  reminder job     │  retrieval     │  (enforcement)  │                     │
└─────────┬──────────────────────────────────────────────────────────────────┘
          ▼
┌── DATA ─ Prisma ORM ───────────────────────────────────────────────────────┐
│  Relational DB        │  Object store           │  Secret store            │
│  (PostgreSQL)         │  (seal photographs)     │  (HMAC signing key)      │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Technology choices, and why

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 16, App Router, React 19 | Server components keep the session on the server; one codebase serves four portals and the public page |
| Language | TypeScript, strict | The certificate payload and role checks are exactly where a type error would be costly |
| Styling | Tailwind CSS v4 with design tokens | One token set drives every surface; no component library to fight |
| Data access | Prisma ORM | Schema is the single source of truth; migrations are reviewable |
| Database | SQLite in development, PostgreSQL in production | Identical Prisma schema; no code change to switch |
| Signing | Node `crypto` + `jsonwebtoken` (HMAC-SHA256) | No external service on the verification path |
| Passwords | Node `crypto.scrypt` | Memory-hard, in the standard library, no dependency |
| QR | `qrcode` | Generates at issue time; nothing needed at verification time |

There is deliberately **no external dependency on the verification path**. A consumer
verifying a sticker touches this application and nothing else.

### 4.2 Data model

```
Business ──< Instrument ──< Application ──1:1── Inspection
    │             │              │
    │             │              └──1:1── Certificate ──< Reminder
    │             └──────────────────────────< Report (citizen complaint)
    └──< User (BUSINESS accounts)

TestCentre ──< User (GATC accounts)
           ──< Application (when dispatched to a centre)
```

Notes on the less obvious columns:

- `Application.assignedOfficerId` and `assignedCentreId` are mutually exclusive — assigning
  one clears the other, so two queues can never claim the same job.
- `Application.scheduledFor` stores the visit as a single timestamp; 10:00 local means the
  morning slot and 14:00 the afternoon slot.
- `Inspection.testWeights` holds the evaluated calibration rows as JSON, and `mpeVerdict`
  the derived PASS/FAIL. Both are computed on the server (§6).
- `Inspection.photoData` holds a compressed JPEG data URL. It is never included in list
  responses; it is served from a separate authorised route.
- `Report.certificateId` and `instrumentId` are nullable — a citizen reporting a *missing*
  sticker has neither.

---

## 5. The tamper-evident certificate

This is the core of the idea and the part worth reading closely.

### 5.1 Issue

When an inspection passes, the server builds a canonical payload — certificate number,
business name and registration, instrument serial, category, model, capacity, validity
window, the officer and badge, the geotag, and the calibration verdict — and signs it:

```
token = HMAC-SHA256( payload, SERVER_SECRET )
```

The token is rendered as a QR code and printed on a sticker affixed to the instrument.

### 5.2 Verify

The public page takes the token from the URL, recomputes the signature from the payload it
carries, and compares. Then it checks the validity window. Three outcomes:

| Outcome | Meaning |
|---|---|
| **Genuine** | Signature matches and the date is inside the validity window |
| **Expired** | Signature matches but the one-year period has lapsed |
| **Tampered** | The signature does not match the payload |

### 5.3 Why this design

- **No database lookup.** Verification is pure computation over the token. A consumer's
  check does not depend on a database being reachable, which matters on a weak mobile
  connection in a crowded market.
- **Nothing to forge offline.** Editing the capacity or the trader name inside the payload
  changes the input to the HMAC, so the signature stops matching. Producing a valid
  signature requires the server secret.
- **The certificate is portable.** The trader can reprint a lost sticker from the QR they
  still hold, because the QR *is* the certificate.

### 5.4 Revocation

A signature, once issued, stays mathematically valid forever — that is precisely what makes
offline verification possible, and it means the token alone cannot express "this certificate
was withdrawn yesterday". Revocation is therefore an **additional** check layered on top of
the signature, never a replacement for it:

1. The signature and validity window are checked first, exactly as in §5.2.
2. If the certificate is signature-valid, the server consults the withdrawal list.
3. A revoked certificate is shown as **Revoked**, with the date and the recorded reason.

HQ revokes from the application queue and must record a reason. A certificate withdrawn in
error can be restored.

If the withdrawal list cannot be reached — a database outage, or a genuinely offline client —
the signature result still stands and the page says plainly that the withdrawal list could
not be checked. A degraded answer, honestly labelled, beats no answer at a shop counter.

---

## 6. The calibration verdict is computed, not typed

An officer does not type PASS or FAIL and have the system believe it. They enter the
standard weights applied and what the instrument displayed. The server then derives, for
each row:

```
error = observed − nominal
MPE   = f(load, e)        where e is the instrument's verification scale interval
row passes if |error| ≤ MPE
```

Following **OIML R76** for accuracy class III, which covers ordinary commercial scales, the
Maximum Permissible Error at initial verification is:

| Load | MPE |
|---|---|
| up to 500 e | ± 0.5 e |
| 500 e to 2000 e | ± 1.0 e |
| 2000 e to 10000 e | ± 1.5 e |

The scale interval `e` is parsed from the instrument's recorded capacity (`"30 kg / 1 g"` →
`e = 1 g`). Where no interval can be parsed — a fuel dispenser rated in litres per minute,
for instance — the weight table does not apply and the officer records the applicable test
in the notes instead.

**The client computes this too, but only for display.** What is stored, and what is signed
into the certificate, is re-derived on the server from the raw readings. A tampered client
cannot manufacture a pass.

### 6.1 Enforcement intelligence — where AI fits, and where it does not

The verdict above is law, so no model is allowed near it. A 94%-confident prediction is not a
lawful basis for a certificate, and the moment a model can influence PASS/FAIL the
"computed, not typed" guarantee is gone.

What a department actually lacks is not a verdict but **targeting**: lakhs of instruments,
a handful of officers, and no way to know which scale to visit first. That is where the
intelligence layer sits — before and around the inspection, never inside it. It lives in
`src/lib/risk.ts`, is served to HQ only by `GET /api/risk`, and appears on the HQ desk as
*Enforcement intelligence*.

**Risk of failing.** Every instrument gets a 0–100 score from signals the platform already
records, each contribution shown with its reason:

| Signal | Why it predicts failure | Points |
|---|---|---|
| Drift — worst \|error\| ÷ MPE at the last inspection | A scale at 93% of its limit last year is the likeliest to be outside it this year | 10 / 22 / 35, or 40 if already outside |
| Certificate lapsed / expiring / never verified | Unverified instruments go unchecked | 25 / 10 / 15 |
| Earlier FAIL verdicts | History repeats | 15 each, capped at 30 |
| Open citizen reports in 90 days | Direct evidence from the counter; short weight weighs most | 25 short weight, 10 other, capped at 30 |
| Instrument category | Dispensers and weighbridges wear faster | 4–15, never enough alone to reach *high* |

Scores of 60+ are *high*, 30+ *medium*. The drift ratio is re-derived from the stored readings
and the capacity with the MPE engine, so it cannot disagree with the verdict.

**Inspection integrity.** Recent inspections are checked for patterns that deserve a second
read: a geotag more than 500 m from the registered premises, a seal photo byte-identical to
another case (SHA-256 stored at write time), no geotag at all, or three or more readings that
all land exactly on the nominal value. Each has an innocent explanation, which is why these are
flags for a person, not outcomes.

**Why rules first.** There is no public dataset of instrument failures, so a trained model on
day one would be trained on nothing. The points model works immediately and explains every
point. A pilot produces what is missing — every inspection is a labelled PASS/FAIL row against
the same signals — after which a gradient-boosted model can replace `scoreInstrument` behind
the same `RiskResult` shape, with per-feature explanations, and be retrained each cycle. The UI
and the API do not change.

**Guard rails.** Advisory only: nothing here blocks, fails, revokes or reorders a verdict. HQ
only: a trader who could see their own score would learn how to game it. Each flag and each
point carries its reason, so an officer is never asked to act on a number alone.

---

## 7. Security framework

### 7.1 Authentication

- Passwords are hashed with **scrypt** and a per-user random salt, stored as `salt:hash`.
  Comparison is constant-time.
- A successful sign-in issues a **signed session token** in an `HttpOnly`, `SameSite=Lax`
  cookie, `Secure` in production, expiring after 12 hours.
- The session secret is **derived from, but not equal to**, the certificate signing secret,
  so a leaked session token can never be replayed as a certificate or the reverse.

### 7.2 Authorisation

Two layers, and the second does not trust the first.

1. **The proxy** (`src/proxy.ts`) runs before any route. It verifies the session signature
   and redirects anonymous users to the login page, or returns 401 for API routes. Public
   paths are listed explicitly: the login and registration pages, the verification portal
   and certificate pages, the sticker page, and the report endpoint.
2. **Each route handler** calls `requireSession(...roles)` and receives either the user or a
   ready-made 401/403 response.

**Identity is never taken from the request body.** The signing officer is the session user.
The business an instrument belongs to is the session user's business. Earlier iterations
passed `businessId` and `officerId` from the client; that was removed precisely because it
was forgeable.

### 7.3 Scoping

Every list endpoint filters by role before it queries:

| Role | Sees |
|---|---|
| `BUSINESS` | Only its own instruments, applications and certificates |
| `OFFICER` | Only applications assigned to that officer |
| `GATC` | Only applications assigned to that centre |
| `ADMIN` | The whole jurisdiction |

### 7.4 Input handling

- Photographs must be image data URLs and are capped at roughly 1.5 MB; oversize uploads are
  rejected with 413. Compression happens on the device before upload.
- Calibration rows are re-parsed and re-evaluated server-side, and capped in number.
- Scheduled visit dates are rejected if unparsable or in the past.
- Citizen reports are length-capped on every free-text field and accept no HTML.
- A certificate reference on a report that does not resolve is dropped rather than rejected,
  so a citizen never loses a report to a typo.

### 7.5 Rate limiting

Fixed-window limits on the endpoints an anonymous caller can reach:

| Endpoint | Limit |
|---|---|
| `POST /api/reports` | 5 per 10 minutes per client |
| `POST /api/auth/login` | 10 per 5 minutes per client |
| `POST /api/auth/register` | 5 per hour per client |

Refusals return 429 with a `Retry-After` header. The counter lives in process memory, which
is correct for a single instance; behind several instances it becomes per-instance and should
be moved to Redis. Only `src/lib/rate-limit.ts` changes — no call site does.

### 7.6 What is deliberately not implemented

Stated plainly, because a security section that claims completeness is not credible:

- No CSRF token; `SameSite=Lax` cookies carry the mitigation, which is adequate here but is
  not defence in depth.
- No audit log of administrative actions. Revocation records who and why; assignment and
  scheduling do not.
- Rate limiting is per-instance, as above.
- The demo password is public and identical across seeded accounts.

---

## 8. Offline capability

Field verification happens in markets, godowns and logistics yards where connectivity is
unreliable. The field view therefore:

- queues a completed inspection — including the compressed photograph and the geotag — in
  device storage when the officer marks themselves offline;
- shows the queue depth and flushes it on demand when signal returns;
- warns if device storage is exhausted rather than silently dropping the record.

The application is installable as a PWA, so an officer can run it full-screen from the home
screen.

---

## 9. Deployment methodology

### 9.1 Topology

```
Internet ──► TLS terminator / reverse proxy ──► app instances (stateless, N)
                                                    │
                                   ┌────────────────┼────────────────┐
                                   ▼                ▼                ▼
                            PostgreSQL       Object store      Secret manager
                            (managed)        (photographs)     (HMAC key)
                                   │
                            Scheduler ──► POST /api/alerts/run  (daily)
```

The application tier holds no state — sessions live in signed cookies — so instances scale
horizontally behind the proxy.

### 9.2 Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | HMAC key for certificate signing |
| `SESSION_SECRET` | Session signing key; **set separately in production** |
| `PUBLIC_ORIGIN` | Origin embedded in QR codes |

The prototype derives `SESSION_SECRET` from `JWT_SECRET` when it is unset. That is
acceptable for a demonstration and must be set explicitly before deployment.

### 9.3 Release steps

1. `prisma migrate deploy` — apply schema changes.
2. `next build` — produce the production bundle.
3. Roll instances behind the proxy; no session invalidation is needed because sessions are
   self-contained.
4. Register the reminder job with the scheduler, pointing at `/api/alerts/run`. The job is
   **idempotent** — one reminder per certificate per threshold — so a retry or a double fire
   sends nothing twice.

### 9.4 Key rotation

Rotating `JWT_SECRET` invalidates every certificate signed with the old key. A production
rollout would carry a key identifier in the payload and verify against a small set of active
keys, so old certificates stay verifiable through their remaining validity. This is designed
for and not yet implemented.

### 9.5 Scaling to a state

The register is naturally partitioned by jurisdiction. The instrument, application and
certificate tables carry the business, which carries the jurisdiction, so read traffic
shards cleanly. The verification path — by far the highest-volume endpoint, since every
consumer scan hits it — performs no database read at all, which is the property that makes
public-scale verification affordable.

---

## 10. Current status

Built and working end to end: all four roles, self-registration, the full six-step workflow,
GPS and photograph capture, the calibration engine, signed certificates with QR, the public
verification page, certificate revocation and restore, printable stickers, camera scanning,
expiry alerts with an idempotent reminder job, citizen reporting with an enforcement queue,
pendency ageing, jurisdiction-wide search, rate limiting on the public endpoints, and the
enforcement-intelligence layer — risk-of-failure ranking and inspection integrity flags.

Tested: 35 unit tests covering the MPE engine (band edges, the sign of the error, floating
point on the limit, empty input), certificate signing (payload tampering, key substitution,
the `alg: none` downgrade), password storage, rate limiting, scanned-token parsing, and the
risk engine (drift against each row's own limit, score caps, category never sufficient on its
own, distance to premises, reused photos, perfect readings). Run with `npm test`.

Not yet built, and honestly noted: an administrative audit log beyond revocation, a
multilingual interface, report export, profile management, supporting-document upload, fee
payment, and bulk import of legacy paper registers.

---

## Appendix — References

1. The Legal Metrology Act, 2009 — Department of Consumer Affairs
2. The Legal Metrology (General) Rules, 2011
3. OIML R76 — Non-automatic weighing instruments
4. RFC 2104 — HMAC: Keyed-Hashing for Message Authentication
5. RFC 7519 — JSON Web Token
6. NIST SP 800-63B — Digital Identity Guidelines, authentication and lifecycle management
