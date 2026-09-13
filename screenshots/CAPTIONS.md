# Screenshots — e-Metrology (SIH26036)

Captured from the running application at 1440×900, 2× (2880×1800 px), full page.
Regenerate at any time with `node scripts/shots.mjs`.

| # | File | Caption to use in the report |
|---|---|---|
| 1 | `01-public-verify.png` | Public verification portal — open to anyone, no account and no app. Scan the sticker, paste the code, or try a sample. |
| 2 | `02-certificate-genuine.png` | A genuine certificate. The HMAC-SHA256 signature is recomputed from the QR itself, so the result does not depend on a database lookup. |
| 3 | `03-certificate-expired.png` | An expired certificate — signature intact, validity lapsed. The instrument must be re-verified before further use in trade. |
| 4 | `04-certificate-tampered.png` | A tampered certificate. The trading name and capacity were edited inside the QR; the signature no longer matches and the page refuses it. |
| 5 | `05-certificate-revoked.png` | A revoked certificate. The signature is still genuine, but the department has withdrawn the certificate and the reason is shown to the public. |
| 6 | `06-business-dashboard.png` | Business portal — instrument registry, certificate status per instrument, and expiry alerts at 30 / 15 / 7 days. |
| 7 | `07-admin-assignment-desk.png` | Admin HQ — pendency by age against the 7-day norm, jurisdiction-wide expiry alerts, the citizen-report enforcement queue, and the application queue. |
| 8 | `08-officer-field-view.png` | Field officer's queue of assigned cases with the scheduled visit date and slot. |
| 9 | `09-officer-inspection-form.png` | On-site verification. Standard weights and instrument readings are entered; the error, the Maximum Permissible Error under OIML R76 class III, and the PASS/FAIL verdict are computed by the server, not typed by the officer. Geotag captured from the device. |
| 10 | `10-testcentre-gatc.png` | The second verification track — a notified Government Approved Test Centre working the same case flow, as the rules allow. |
| 11 | `11-search.png` | Jurisdiction-wide search across businesses, instruments and certificates. |
| 12 | `12-sticker-sheet.png` | The printable verification sticker — three copies per page. The QR carries the signed certificate itself, so a shopper can verify it even if the server is unreachable. |
| 13 | `13-login.png` | Sign-in with the four demo roles. |
| 14 | `14-register.png` | Business self-registration. |
| 15 | `15-ai-likely-to-fail.png` | Enforcement intelligence at HQ — instruments ranked by risk of failing their next verification, each score broken into its reasons (drift toward the limit, lapsed validity, citizen complaints). Advisory only; the verdict still comes from the readings. |
| 16 | `16-ai-inspections-to-review.png` | Inspection integrity flags — a geotag 3.5 km from the registered shop, and a record where every reading sits exactly on the nominal value. Flags for a person to read, never automatic outcomes. |

## A suggested six-figure set, if space is tight

`06` → `07` → `09` → `02` → `12` → `04`

That set walks the whole workflow: apply, dispatch, inspect and compute, certify,
print the sticker, and finally catch a forgery.
