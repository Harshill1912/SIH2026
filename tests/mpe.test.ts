import { test } from "node:test";
import assert from "node:assert/strict";
import {
  divisionFromCapacity,
  mpeForLoad,
  evaluateRow,
  evaluateAll,
  verdictFor,
  parseTestWeights,
  formatError,
  formatMass,
} from "../src/lib/mpe";

/*
 * The calibration engine decides whether a trader's scale is lawful. If it is
 * wrong in the permissive direction a bad instrument is certified; in the strict
 * direction an honest trader is failed. Both matter, so both are tested.
 */

test("division is parsed from the capacity string", () => {
  assert.equal(divisionFromCapacity("30 kg / 1 g"), 1);
  assert.equal(divisionFromCapacity("300 kg / 50 g"), 50);
  assert.equal(divisionFromCapacity("30 kg / 2 kg"), 2000);
  assert.equal(divisionFromCapacity("5 g / 100 mg"), 0.1);
});

test("a capacity with no weight division yields null, not a guess", () => {
  // A fuel dispenser is rated in litres per minute; the weight table cannot apply.
  assert.equal(divisionFromCapacity("45 L/min"), null);
  assert.equal(divisionFromCapacity("60 Metric Tonnes"), null);
  assert.equal(divisionFromCapacity(""), null);
  assert.equal(divisionFromCapacity("30 kg / 0 g"), null);
});

test("MPE follows the OIML R76 class III bands", () => {
  // e = 1 g, so the band edges fall at 500 g and 2000 g.
  assert.equal(mpeForLoad(500, 1), 0.5); // 500 e — top of the first band
  assert.equal(mpeForLoad(501, 1), 1.0); // just over: second band
  assert.equal(mpeForLoad(2000, 1), 1.0); // 2000 e — top of the second
  assert.equal(mpeForLoad(2001, 1), 1.5); // just over: third band
});

test("MPE scales with the division, not with the absolute load", () => {
  // 5000 g on a 50 g division is only 100 e, so it sits in the FIRST band.
  assert.equal(mpeForLoad(5000, 50), 25); // 0.5 x 50
  // The same load on a 1 g division is 5000 e — the third band.
  assert.equal(mpeForLoad(5000, 1), 1.5);
});

test("a reading exactly on the limit passes; one beyond it fails", () => {
  const onLimit = evaluateRow({ nominalG: 1000, observedG: 1001 }, 1);
  assert.equal(onLimit.mpeG, 1);
  assert.equal(onLimit.errorG, 1);
  assert.equal(onLimit.pass, true, "error equal to the MPE is within tolerance");

  const beyond = evaluateRow({ nominalG: 1000, observedG: 1001.5 }, 1);
  assert.equal(beyond.pass, false);
});

test("under-reading is judged the same as over-reading", () => {
  const under = evaluateRow({ nominalG: 1000, observedG: 998.5 }, 1);
  const over = evaluateRow({ nominalG: 1000, observedG: 1001.5 }, 1);
  assert.equal(under.pass, false);
  assert.equal(over.pass, false);
  assert.equal(under.errorG, -1.5);
  assert.equal(over.errorG, 1.5);
});

test("floating point does not fail a reading that is exactly on the limit", () => {
  // 0.1 + 0.2 style drift must not push a legitimate pass over the edge.
  const r = evaluateRow({ nominalG: 500.1, observedG: 500.6 }, 1);
  assert.equal(r.pass, true);
});

test("one bad row fails the whole verdict", () => {
  const rows = evaluateAll(
    [
      { nominalG: 500, observedG: 500 },
      { nominalG: 1000, observedG: 1003 }, // 3 g error against a 1 g MPE
      { nominalG: 5000, observedG: 5001 },
    ],
    1
  );
  assert.equal(rows[0].pass, true);
  assert.equal(rows[1].pass, false);
  assert.equal(verdictFor(rows), "FAIL");
});

test("all rows within tolerance give PASS", () => {
  const rows = evaluateAll(
    [
      { nominalG: 500, observedG: 500 },
      { nominalG: 1000, observedG: 1000.5 },
      { nominalG: 20000, observedG: 20001 },
    ],
    1
  );
  assert.equal(verdictFor(rows), "PASS");
});

test("no rows means no verdict — never a silent pass", () => {
  assert.equal(verdictFor([]), null);
});

test("stored rows survive a round trip, and malformed JSON does not throw", () => {
  const rows = evaluateAll([{ nominalG: 1000, observedG: 1000.5 }], 1);
  assert.deepEqual(parseTestWeights(JSON.stringify(rows)), rows);
  assert.deepEqual(parseTestWeights("not json"), []);
  assert.deepEqual(parseTestWeights(null), []);
  assert.deepEqual(parseTestWeights('{"not":"an array"}'), []);
});

test("errors are formatted with a visible direction", () => {
  assert.equal(formatError(1.5), "+1.5 g");
  assert.equal(formatError(-1.5), "−1.5 g");
  assert.equal(formatError(0), "±0 g");
  assert.equal(formatMass(20000), "20 kg");
  assert.equal(formatMass(500), "500 g");
});
