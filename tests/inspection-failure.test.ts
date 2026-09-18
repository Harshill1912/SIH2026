import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAILURE_REASONS,
  formatFailureNote,
  parseFailureReasons,
} from "../src/lib/inspection-failure";

test("FAILURE_REASONS includes standard legal metrology categories", () => {
  assert.ok(FAILURE_REASONS.length >= 6);
  assert.ok(FAILURE_REASONS.some((r) => r.id === "EXCEEDS_MPE"));
  assert.ok(FAILURE_REASONS.some((r) => r.id === "SEAL_TAMPERED"));
});

test("formatFailureNote formats structured reasons and optional note", () => {
  const noteOnly = formatFailureNote([], "Test note");
  assert.equal(noteOnly, "Test note");

  const single = formatFailureNote(["EXCEEDS_MPE"], "");
  assert.equal(single, "[Rejection reasons: Measurement error exceeds MPE tolerance]");

  const combined = formatFailureNote(["EXCEEDS_MPE", "SEAL_TAMPERED"], "Lead wire was severed");
  assert.equal(
    combined,
    "[Rejection reasons: Measurement error exceeds MPE tolerance; Physical seal broken, missing or tampered] Lead wire was severed"
  );
});

test("parseFailureReasons extracts reasons and user notes correctly", () => {
  const empty = parseFailureReasons(null);
  assert.deepEqual(empty.reasons, []);
  assert.equal(empty.userNote, "");

  const plain = parseFailureReasons("Just regular text");
  assert.deepEqual(plain.reasons, []);
  assert.equal(plain.userNote, "Just regular text");

  const parsed = parseFailureReasons(
    "[Rejection reasons: Measurement error exceeds MPE tolerance; Physical seal broken, missing or tampered] Knife edge damaged"
  );
  assert.equal(parsed.reasons.length, 2);
  assert.equal(parsed.reasons[0], "Measurement error exceeds MPE tolerance");
  assert.equal(parsed.reasons[1], "Physical seal broken, missing or tampered");
  assert.equal(parsed.userNote, "Knife edge damaged");
});
