import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emailError,
  firstRegisterError,
  formatPhone,
  normalizeEmail,
  passwordError,
  passwordRules,
  phoneDigits,
  phoneError,
} from "../src/lib/validation";

/*
 * These rules run in the browser for feedback and on the server for
 * enforcement. The server copy is the one that matters, so every case here is
 * one a hand-crafted request could send.
 */

test("valid email addresses are accepted and normalised", () => {
  for (const ok of ["owner@abctraders.in", "ramesh.gupta+shop@gmail.com", "a_b-c@mail.gov.in", "x1@y.co"]) {
    assert.equal(emailError(ok), null, ok);
  }
  assert.equal(normalizeEmail("  Owner@ABCTraders.IN "), "owner@abctraders.in");
  assert.equal(emailError("  Owner@ABCTraders.IN "), null);
});

test("malformed email addresses are rejected", () => {
  for (const bad of [
    "", "owner", "owner@", "@abctraders.in", "owner@abctraders", "owner@abctraders.i",
    "owner@@abctraders.in", "own er@abctraders.in", "owner@abc_traders.in", "owner..x@abc.in",
    ".owner@abc.in", "owner.@abc.in", "owner@-abc.in", "owner@abc-.in", "owner@abc.123",
  ]) {
    assert.notEqual(emailError(bad), null, `should reject "${bad}"`);
  }
  assert.notEqual(emailError(`${"a".repeat(250)}@x.in`), null);
});

test("a 10-digit Indian mobile is accepted, with or without prefix and spacing", () => {
  for (const ok of ["9876543210", "98765 43210", "+91 98765 43210", "+919876543210", "09876543210", "6000000001"]) {
    assert.equal(phoneError(ok), null, ok);
    assert.equal(phoneDigits(ok).length, 10);
  }
  assert.equal(formatPhone("+91-98765-43210"), "+91 98765 43210");
});

test("phone numbers that are not exactly 10 digits, or not mobile, are rejected", () => {
  assert.match(phoneError("98765")!, /exactly 10 digits \(you entered 5\)/);
  assert.match(phoneError("987654321012")!, /exactly 10 digits/);
  assert.match(phoneError("5876543210")!, /starts with 6, 7, 8 or 9/);
  assert.match(phoneError("98765abc10")!, /only contain digits/);
  assert.match(phoneError("9999999999")!, /real mobile/);
  assert.notEqual(phoneError(""), null);
});

test("a strong password passes every rule", () => {
  assert.equal(passwordError("Grocery#4821Mart"), null);
  assert.ok(passwordRules("Grocery#4821Mart").every((r) => r.ok));
});

test("weak passwords name exactly what is missing", () => {
  assert.equal(passwordError("demo1234"), "Password needs: an uppercase letter, a symbol");
  assert.equal(passwordError("Ab1!"), "Password needs: 8+ characters");
  assert.equal(passwordError("ALLCAPS#123"), "Password needs: a lowercase letter");
  assert.equal(passwordError("NoDigits!here"), "Password needs: a number");
  assert.notEqual(passwordError(""), null);
});

test("common, repetitive, padded or personal passwords are rejected", () => {
  assert.match(passwordError("Password@123")!, /too common/);
  assert.match(passwordError("Aaaaa#1234")!, /repeat/);
  assert.match(passwordError(" Grocery#4821 ")!, /start or end with a space/);
  assert.match(passwordError("Ramesh#2026x", { email: "ramesh@abc.in" })!, /email name/);
  assert.match(passwordError("Sunil#2026xy", { name: "Sunil Verma" })!, /your name/);
  assert.notEqual(passwordError("A1!" + "b".repeat(126)), null);
});

test("firstRegisterError reports the first failing field in form order", () => {
  const good = {
    businessName: "Verma Grocery & Mart",
    regNo: "VGM-DL-2026-4821",
    address: "Shop 28, Sector 14 Market, Rohini, New Delhi 110085",
    contact: "9871122334",
    ownerName: "Sunil Verma",
    email: "trader.4821@vermagrocery.in",
    password: "Grocery#4821Mart",
  };
  assert.equal(firstRegisterError(good), null);
  assert.equal(firstRegisterError({ ...good, contact: "12345" })!.field, "contact");
  assert.equal(firstRegisterError({ ...good, email: "nope", password: "weak" })!.field, "email");
  assert.equal(firstRegisterError({ ...good, ownerName: "R2D2" })!.field, "ownerName");
  assert.equal(firstRegisterError({ ...good, regNo: "AB<script>" })!.field, "regNo");
});
