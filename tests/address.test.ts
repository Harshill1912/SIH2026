import { test } from "node:test";
import assert from "node:assert/strict";
import { ADDRESS_MAX, formatPremisesAddress } from "../src/lib/address";

/*
 * The detected address pre-fills a legal registration record, so it must read
 * like a postal address and never repeat itself.
 */

test("a full OSM result reads most-specific first, postcode with the state", () => {
  const a = formatPremisesAddress({
    shop: "ABC Traders",
    house_number: "14",
    road: "Main Market",
    suburb: "Connaught Place",
    city: "New Delhi",
    state: "Delhi",
    postcode: "110001",
  });
  assert.equal(a, "ABC Traders, 14 Main Market, Connaught Place, New Delhi, Delhi 110001");
});

test("repeated and contained place names are dropped", () => {
  const a = formatPremisesAddress({
    road: "Ajmal Khan Road",
    neighbourhood: "Karol Bagh",
    suburb: "Karol Bagh",
    city_district: "Central Delhi",
    city: "Delhi",
    state_district: "Central Delhi",
    state: "Delhi",
    postcode: "110005",
  });
  assert.equal(a, "Ajmal Khan Road, Karol Bagh, Central Delhi, Delhi 110005");
});

test("a short name is dropped even when the longer one comes after it", () => {
  // Real Nominatim shape for Karol Bagh: city "Delhi" precedes state_district "Central Delhi".
  const a = formatPremisesAddress({
    suburb: "Karol Bagh",
    city: "Delhi",
    state_district: "Central Delhi",
    state: "Delhi",
    postcode: "110060",
  });
  assert.equal(a, "Karol Bagh, Central Delhi, Delhi 110060");
});

test("towns and villages stand in for a city; the place name wins over the shop tag", () => {
  assert.equal(
    formatPremisesAddress({ road: "Station Road", village: "Sanand", state: "Gujarat", postcode: "382110" }),
    "Station Road, Sanand, Gujarat 382110"
  );
  assert.equal(formatPremisesAddress({ shop: "kirana", road: "MG Road" }, "Verma Mart"), "Verma Mart, MG Road");
});

test("an empty result gives an empty address, and long ones are capped", () => {
  assert.equal(formatPremisesAddress({}), "");
  assert.ok(formatPremisesAddress({ road: "x".repeat(400) }).length <= ADDRESS_MAX);
});
