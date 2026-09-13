import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { rateLimit } from "../src/lib/rate-limit";
import { tokenFromScan } from "../src/components/public/PublicVerificationPortal";

/*
 * The certificate's whole claim is: edit the payload and the signature stops
 * matching. That claim is the product, so it is tested directly rather than
 * assumed from the library.
 */

const SECRET = "test-secret-for-certificate-signing";

const payload = {
  certId: "CERT-LM-2026-0001",
  businessName: "ABC Traders",
  serialNumber: "SCALE-2024-001",
  capacity: "30 kg / 1 g",
  validTill: "2027-01-01T00:00:00.000Z",
};

test("a certificate signed with the key verifies with that key", () => {
  const token = jwt.sign(payload, SECRET, { algorithm: "HS256" });
  const back = jwt.verify(token, SECRET) as typeof payload;
  assert.equal(back.certId, payload.certId);
  assert.equal(back.capacity, payload.capacity);
});

test("editing the capacity inside the payload breaks the signature", () => {
  const token = jwt.sign(payload, SECRET, { algorithm: "HS256" });
  const [header, , signature] = token.split(".");

  // Exactly the attack the public page must catch: re-encode the payload with a
  // bigger capacity, keep the original signature.
  const forged = Buffer.from(
    JSON.stringify({ ...payload, capacity: "100 kg / 10 g" })
  ).toString("base64url");
  const tampered = `${header}.${forged}.${signature}`;

  assert.throws(() => jwt.verify(tampered, SECRET), /invalid signature/i);
});

test("changing the trader's name breaks the signature", () => {
  const token = jwt.sign(payload, SECRET, { algorithm: "HS256" });
  const [header, , signature] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ ...payload, businessName: "FRAUDULENT ENTERPRISES" })
  ).toString("base64url");
  assert.throws(() => jwt.verify(`${header}.${forged}.${signature}`, SECRET));
});

test("a certificate signed with a different key does not verify", () => {
  const token = jwt.sign(payload, "some-other-key", { algorithm: "HS256" });
  assert.throws(() => jwt.verify(token, SECRET));
});

test("an unsigned 'none' algorithm token is rejected", () => {
  // Classic JWT downgrade: strip the signature and claim no algorithm.
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  assert.throws(() => jwt.verify(`${header}.${body}.`, SECRET));
});

test("the payload is readable without the key — it is signed, not encrypted", () => {
  // Worth asserting so nobody later puts a secret in the certificate.
  const token = jwt.sign(payload, SECRET, { algorithm: "HS256" });
  const decoded = jwt.decode(token) as typeof payload;
  assert.equal(decoded.serialNumber, payload.serialNumber);
});

/* ── password storage ──────────────────────────────────────────────────── */

test("a password verifies against its own hash and nothing else", () => {
  const stored = hashPassword("demo1234");
  assert.ok(verifyPassword("demo1234", stored));
  assert.equal(verifyPassword("demo12345", stored), false);
  assert.equal(verifyPassword("", stored), false);
});

test("the same password hashes differently each time (per-user salt)", () => {
  assert.notEqual(hashPassword("demo1234"), hashPassword("demo1234"));
});

test("a missing or malformed hash never authenticates", () => {
  assert.equal(verifyPassword("demo1234", null), false);
  assert.equal(verifyPassword("demo1234", ""), false);
  assert.equal(verifyPassword("demo1234", "no-colon-here"), false);
});

/* ── rate limiting ─────────────────────────────────────────────────────── */

test("a burst is allowed up to the limit, then refused", () => {
  const key = `test-${Math.random()}`;
  for (let i = 0; i < 3; i++) {
    assert.equal(rateLimit(key, 3, 60_000).ok, true, `attempt ${i + 1} should pass`);
  }
  const blocked = rateLimit(key, 3, 60_000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter > 0, "a refused caller is told when to retry");
});

test("separate clients do not share a budget", () => {
  const a = `a-${Math.random()}`;
  const b = `b-${Math.random()}`;
  rateLimit(a, 1, 60_000);
  assert.equal(rateLimit(a, 1, 60_000).ok, false);
  assert.equal(rateLimit(b, 1, 60_000).ok, true, "one abuser must not lock out everyone");
});

test("the window reopens once it has elapsed", async () => {
  const key = `w-${Math.random()}`;
  assert.equal(rateLimit(key, 1, 30).ok, true);
  assert.equal(rateLimit(key, 1, 30).ok, false);
  await new Promise((r) => setTimeout(r, 45));
  assert.equal(rateLimit(key, 1, 30).ok, true);
});

/* ── what a scanned sticker yields ─────────────────────────────────────── */

test("a scanned verification URL is reduced to the bare token", () => {
  assert.equal(tokenFromScan("https://example.gov.in/verify/abc.def.ghi"), "abc.def.ghi");
  assert.equal(tokenFromScan("http://localhost:3000/verify/abc.def.ghi"), "abc.def.ghi");
  // A code typed by hand is already bare.
  assert.equal(tokenFromScan("  abc.def.ghi  "), "abc.def.ghi");
  // Percent-encoding survives the round trip.
  assert.equal(tokenFromScan("https://x/verify/a%2Bb"), "a+b");
});
