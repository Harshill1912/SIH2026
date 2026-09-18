import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capacityError,
  firstInstrumentError,
  instrumentErrors,
  locationError,
  modelError,
  normalizeSerial,
  serialNumberError,
} from "../src/lib/instrument-validation";

test("valid instrument inputs pass validation", () => {
  const valid = {
    serialNumber: "SCALE-2024-002",
    category: "Electronic Counter Scale",
    model: "Essae DS-215 Precision",
    capacity: "15 kg / 1 g",
    location: "Counter 2 – Express",
  };
  assert.equal(firstInstrumentError(valid), null);
  const errors = instrumentErrors(valid);
  assert.equal(errors.serialNumber, null);
  assert.equal(errors.category, null);
  assert.equal(errors.model, null);
  assert.equal(errors.capacity, null);
  assert.equal(errors.location, null);
});

test("serial numbers: rejects dummy '1', repeats, and invalid formats", () => {
  assert.notEqual(serialNumberError("1"), null, "should reject '1'");
  assert.notEqual(serialNumberError("11"), null, "should reject '11'");
  assert.notEqual(serialNumberError("1111"), null, "should reject repeated 1s");
  assert.notEqual(serialNumberError("AAAA"), null, "should reject repeated characters");
  assert.notEqual(serialNumberError("---"), null, "should reject pure hyphens");
  assert.notEqual(serialNumberError("SCALE 2024"), null, "should reject spaces");
  assert.notEqual(serialNumberError(""), null, "should reject empty");

  // Valid formats
  assert.equal(serialNumberError("SCALE-2024-002"), null);
  assert.equal(serialNumberError("WB-DL-01"), null);
  assert.equal(serialNumberError("FD/2026/99"), null);
  assert.equal(normalizeSerial("  scale-2024  "), "SCALE-2024");
});

test("model: rejects '1', purely numeric, or single-character inputs", () => {
  assert.notEqual(modelError("1"), null, "should reject '1'");
  assert.notEqual(modelError("1234"), null, "should reject purely numeric '1234'");
  assert.notEqual(modelError("m"), null, "should reject single character 'm'");
  assert.notEqual(modelError("---"), null, "should reject symbols only");
  assert.notEqual(modelError(""), null, "should reject empty");

  // Valid models
  assert.equal(modelError("Essae DS-215 Precision"), null);
  assert.equal(modelError("Avery Weigh-Tronix BridgeMaster"), null);
  assert.equal(modelError("Tokheim Quantium 510"), null);
});

test("capacity: rejects '1', missing numbers, missing units, or incompatible units", () => {
  assert.notEqual(capacityError("1"), null, "should reject '1'");
  assert.notEqual(capacityError("60"), null, "should reject '60' without unit");
  assert.notEqual(capacityError("Hiten Darindaa"), null, "should reject text without numbers");
  assert.notEqual(capacityError(""), null, "should reject empty");

  // Category-scoped checks
  // Weighbridge cannot use litres
  assert.notEqual(
    capacityError("60 litres", "Weighbridge (Heavy Vehicle)"),
    null,
    "should reject litres for weighbridge"
  );
  // Counter scale cannot use litres
  assert.notEqual(
    capacityError("15 L/min", "Electronic Counter Scale"),
    null,
    "should reject L/min for counter scale"
  );
  // Fuel dispenser cannot use kg
  assert.notEqual(
    capacityError("50 kg", "Fuel Dispenser (Petrol/Diesel)"),
    null,
    "should reject kg for fuel dispenser"
  );

  // Valid capacities
  assert.equal(capacityError("15 kg / 1 g", "Electronic Counter Scale"), null);
  assert.equal(capacityError("60 Metric Tonnes", "Weighbridge (Heavy Vehicle)"), null);
  assert.equal(capacityError("45 L/min", "Fuel Dispenser (Petrol/Diesel)"), null);
  assert.equal(capacityError("30 m", "Commercial Length & Linear Measure"), null);
});

test("location: optional, but rejects '1' if provided", () => {
  assert.equal(locationError(""), null, "empty location is allowed");
  assert.equal(locationError(undefined), null, "undefined location is allowed");
  assert.notEqual(locationError("1"), null, "should reject '1'");
  assert.notEqual(locationError("999"), null, "should reject purely numeric location");
  assert.equal(locationError("Counter 2 – Retail billing"), null);
  assert.equal(locationError("Logistics Yard, Gate 1"), null);
});

test("firstInstrumentError returns the first failing field in form order", () => {
  // All fields set to '1' as reported in Bug 4
  const garbageAllOne = {
    serialNumber: "1",
    category: "Electronic Counter Scale",
    model: "1",
    capacity: "1",
    location: "1",
  };
  const first = firstInstrumentError(garbageAllOne);
  assert.notEqual(first, null);
  assert.equal(first?.field, "serialNumber");

  const badModel = {
    serialNumber: "SCALE-2024-001",
    category: "Electronic Counter Scale",
    model: "1",
    capacity: "15 kg / 1 g",
  };
  assert.equal(firstInstrumentError(badModel)?.field, "model");

  const badCapacity = {
    serialNumber: "SCALE-2024-001",
    category: "Electronic Counter Scale",
    model: "Essae DS-215",
    capacity: "1",
  };
  assert.equal(firstInstrumentError(badCapacity)?.field, "capacity");
});
