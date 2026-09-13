import { test } from "node:test";
import assert from "node:assert/strict";
import { driftRatio, integrityFlags, scoreInstrument, type RiskInput } from "../src/lib/risk";
import { distanceM } from "../src/lib/geo";

/*
 * The risk engine decides where an officer goes first, and the integrity check
 * decides whose record gets read twice. Neither may ever overrule the MPE
 * verdict, and both must explain themselves — so the reasons are tested as
 * carefully as the numbers.
 */

const base: RiskInput = {
  category: "Electronic Counter Scale",
  capacity: "30 kg / 1 g",
  lastReadings: [],
  failCount: 0,
  daysToExpiry: 200,
  reportKinds: [],
};

test("a healthy, recently verified counter scale is low risk", () => {
  const r = scoreInstrument({
    ...base,
    lastReadings: [{ nominalG: 500, observedG: 500.1 }, { nominalG: 5000, observedG: 5000.3 }],
  });
  assert.equal(r.band, "LOW");
  assert.ok(r.score < 30);
});

test("drift is measured against each row's own limit, not a fixed tolerance", () => {
  // 500 g on a 1 g scale allows ±0.5 g; 5 kg allows ±1.5 g.
  assert.equal(driftRatio("30 kg / 1 g", [{ nominalG: 500, observedG: 500.45 }]), 0.9);
  assert.ok(Math.abs(driftRatio("30 kg / 1 g", [{ nominalG: 5000, observedG: 5000.45 }])! - 0.3) < 1e-9);
  // No division → drift cannot be judged, and is not invented.
  assert.equal(driftRatio("60 Metric Tonnes", [{ nominalG: 500, observedG: 501 }]), null);
});

test("a scale reading near its limit scores more than one comfortably inside it", () => {
  const near = scoreInstrument({ ...base, lastReadings: [{ nominalG: 500, observedG: 500.48 }] });
  const far = scoreInstrument({ ...base, lastReadings: [{ nominalG: 500, observedG: 500.1 }] });
  assert.ok(near.score > far.score);
  assert.equal(near.factors[0].key, "DRIFT");
  assert.match(near.factors[0].label, /96% of its limit/);
});

test("a lapsed fuel dispenser with a short-weight complaint is high risk, with reasons", () => {
  const r = scoreInstrument({
    ...base,
    category: "Fuel Dispenser (Petrol/Diesel)",
    capacity: "45 L/min",
    daysToExpiry: -10,
    reportKinds: ["SHORT_WEIGHT"],
  });
  assert.equal(r.band, "HIGH");
  const keys = r.factors.map((f) => f.key);
  assert.deepEqual(keys.slice(0, 2).sort(), ["LAPSED", "REPORTS"]);
  assert.ok(r.factors.every((f) => f.label.length > 0 && f.points > 0));
  // Factors are ordered by contribution, and add up to the score.
  assert.equal(r.score, r.factors.reduce((n, f) => n + f.points, 0));
});

test("category alone can never make an instrument high risk", () => {
  const r = scoreInstrument({ ...base, category: "Fuel Dispenser (Petrol/Diesel)", capacity: "45 L/min" });
  assert.equal(r.band, "LOW");
});

test("score is capped at 100 and complaint points are capped", () => {
  const r = scoreInstrument({
    ...base,
    category: "Fuel Dispenser",
    lastReadings: [{ nominalG: 500, observedG: 502 }],
    failCount: 5,
    daysToExpiry: -400,
    reportKinds: ["SHORT_WEIGHT", "SHORT_WEIGHT", "SHORT_WEIGHT"],
  });
  assert.equal(r.score, 100);
  assert.equal(r.factors.find((f) => f.key === "REPORTS")!.points, 30);
  assert.equal(r.factors.find((f) => f.key === "PAST_FAIL")!.points, 30);
});

test("distance between Connaught Place and Karol Bagh is about 3.5 km", () => {
  const m = distanceM({ lat: 28.6328, lng: 77.2197 }, { lat: 28.6519, lng: 77.1909 });
  assert.ok(m > 3300 && m < 3700, `got ${m}`);
});

test("an inspection geotagged away from the premises is flagged; one at the shop is not", () => {
  const shop = { lat: 28.6519, lng: 77.1909 };
  const common = { capacity: "30 kg / 5 g", readings: [], premises: shop, photoSharedWith: [] };
  const away = integrityFlags({ ...common, geotag: { lat: 28.6328, lng: 77.2197 } });
  assert.equal(away[0].key, "FAR_FROM_PREMISES");
  assert.match(away[0].label, /3\.\d km/);
  assert.deepEqual(integrityFlags({ ...common, geotag: { lat: 28.6521, lng: 77.1911 } }), []);
  // Unknown premises: skip the check rather than guess.
  assert.deepEqual(integrityFlags({ ...common, premises: null, geotag: { lat: 0, lng: 0 } }), []);
});

test("perfect readings are flagged only with enough rows to be suspicious", () => {
  const exact = [5000, 10000, 20000].map((n) => ({ nominalG: n, observedG: n }));
  const common = { capacity: "300 kg / 50 g", geotag: { lat: 1, lng: 1 }, premises: null, photoSharedWith: [] };
  assert.equal(integrityFlags({ ...common, readings: exact })[0].key, "PERFECT_READINGS");
  assert.deepEqual(integrityFlags({ ...common, readings: exact.slice(0, 2) }), []);
  const oneOff = [...exact.slice(0, 2), { nominalG: 20000, observedG: 20010 }];
  assert.deepEqual(integrityFlags({ ...common, readings: oneOff }), []);
});

test("a reused seal photo and a missing geotag are flagged, high severity first", () => {
  const flags = integrityFlags({
    capacity: "30 kg / 1 g",
    readings: [],
    geotag: null,
    premises: null,
    photoSharedWith: ["APP-2026-1111"],
  });
  assert.deepEqual(flags.map((f) => f.key), ["REUSED_PHOTO", "NO_GEOTAG"]);
  assert.match(flags[0].label, /APP-2026-1111/);
});
