import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGeofence, fixError, formatDistance } from "../src/lib/geofence";

/*
 * The geofence decides whether a certificate may be generated at all, so both
 * directions matter: an officer standing in the shop must never be refused, and
 * one sitting in the office must never be let through.
 */

// ABC Traders, Connaught Place.
const shop = { lat: 28.6328, lng: 77.2197 };
const opts = { radiusM: 200, maxAccuracyM: 100, allowManual: false };
const device = (lat: number, lng: number, accuracyM = 12) => ({ lat, lng, accuracyM, source: "device" as const });

test("an officer at the shop is inside the fence", () => {
  const r = checkGeofence(device(28.6329, 77.2198), shop, opts);
  assert.equal(r.status, "inside");
  if (r.status === "inside") assert.ok(r.distanceM < 20);
});

test("just inside and just outside the radius", () => {
  // ~0.0017° of latitude ≈ 189 m; ~0.0019° ≈ 211 m.
  assert.equal(checkGeofence(device(shop.lat + 0.0017, shop.lng), shop, opts).status, "inside");
  const out = checkGeofence(device(shop.lat + 0.0019, shop.lng), shop, opts);
  assert.equal(out.status, "outside");
  if (out.status === "outside") assert.match(out.message, /21\d m from the registered premises.*within 200 m/);
});

test("an officer in another part of the city is refused, with the distance", () => {
  const karolBagh = device(28.6519, 77.1909);
  const r = checkGeofence(karolBagh, shop, opts);
  assert.equal(r.status, "outside");
  if (r.status === "outside") {
    assert.ok(r.distanceM > 3300 && r.distanceM < 3700);
    assert.match(r.message, /3\.5 km/);
  }
});

test("no location, or an invalid one, is refused before any distance is computed", () => {
  assert.equal(checkGeofence(null, shop, opts).status, "bad-fix");
  assert.equal(checkGeofence({ lat: null, lng: null, accuracyM: null }, shop, opts).status, "bad-fix");
  assert.equal(checkGeofence(device(91, 77), shop, opts).status, "bad-fix");
  assert.equal(checkGeofence(device(Number.NaN, 77), shop, opts).status, "bad-fix");
});

test("an imprecise GPS fix is refused even when it lands on the shop", () => {
  const r = checkGeofence(device(shop.lat, shop.lng, 450), shop, opts);
  assert.equal(r.status, "bad-fix");
  assert.match(fixError(device(shop.lat, shop.lng, 450), opts)!, /±450 m.*within ±100 m/);
  assert.match(fixError({ ...device(shop.lat, shop.lng), accuracyM: null }, opts)!, /accuracy is unknown/);
});

test("a hand-picked location is refused unless demo locations are switched on", () => {
  const manual = { lat: shop.lat, lng: shop.lng, accuracyM: null, source: "manual" as const };
  assert.equal(checkGeofence(manual, shop, opts).status, "bad-fix");
  assert.equal(checkGeofence(manual, shop, { ...opts, allowManual: true }).status, "inside");
});

test("a business with no pinned premises cannot be inspected", () => {
  const r = checkGeofence(device(shop.lat, shop.lng), { lat: null, lng: null }, opts);
  assert.equal(r.status, "no-premises");
  assert.equal(checkGeofence(device(shop.lat, shop.lng), null, opts).status, "no-premises");
});

test("distances read naturally", () => {
  assert.equal(formatDistance(35.4), "35 m");
  assert.equal(formatDistance(999), "999 m");
  assert.equal(formatDistance(3526), "3.5 km");
});
