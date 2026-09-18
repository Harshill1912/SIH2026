/**
 * Instrument registration input rules.
 * Pure and client-safe, shared by the registration modal (instant feedback)
 * and the API route (server enforcement) to reject placeholder and malformed data.
 */

export const INSTRUMENT_CATEGORIES = [
  "Electronic Counter Scale",
  "Weighbridge (Heavy Vehicle)",
  "Fuel Dispenser (Petrol/Diesel)",
  "Platform Scale (Industrial)",
  "Automatic Gravimetric Filling",
  "Commercial Length & Linear Measure",
] as const;

export type InstrumentCategory = (typeof INSTRUMENT_CATEGORIES)[number];

export type InstrumentField = "serialNumber" | "category" | "model" | "capacity" | "location";

export interface InstrumentInput {
  serialNumber: string;
  category: string;
  model: string;
  capacity: string;
  location?: string;
}

export function normalizeSerial(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Serial number must be 3–30 characters, alphanumeric with hyphens or slashes.
 * Rejects single characters (e.g. "1"), repeating dummy characters ("111", "AAA"),
 * and strings with invalid symbols.
 */
export function serialNumberError(raw: string): string | null {
  const v = normalizeSerial(raw);
  if (!v) return "Serial number is required";
  if (v.length < 3) return "Serial number must be at least 3 characters";
  if (v.length > 30) return "Serial number cannot exceed 30 characters";
  if (!/^[A-Z0-9][A-Z0-9\/-]*[A-Z0-9]$/.test(v)) {
    return "Use uppercase letters, numbers, hyphens and slashes (e.g. SCALE-2024-002)";
  }
  // Reject pure repeating noise like "111", "---", "AAAA"
  if (/^(.)\1+$/.test(v)) {
    return "Enter a realistic serial number, not repeated characters";
  }
  return null;
}

export function categoryError(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Category is required";
  if (!INSTRUMENT_CATEGORIES.includes(v as InstrumentCategory)) {
    return "Select a recognized instrument category";
  }
  return null;
}

/**
 * Make / model: 2–60 characters.
 * Must contain letters — rejects purely numeric placeholder values like "1" or "1234".
 */
export function modelError(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Make / model is required";
  if (v.length < 2) return "Make / model must be at least 2 characters";
  if (v.length > 60) return "Make / model cannot exceed 60 characters";
  if (/^\d+$/.test(v)) return "Make / model must include letters, not just numbers";
  if (!/[A-Za-z]/.test(v)) return "Make / model must contain letters";
  if (/^(.)\1{2,}$/.test(v)) return "Enter a valid make and model name";
  return null;
}

export interface CapacityUnitOption {
  value: string;
  label: string;
}

export const CATEGORY_UNITS: Record<InstrumentCategory, CapacityUnitOption[]> = {
  "Electronic Counter Scale": [
    { value: "kg / 1 g", label: "kg / 1 g (Retail counter · e = 1 g)" },
    { value: "kg / 2 g", label: "kg / 2 g (Retail counter · e = 2 g)" },
    { value: "kg / 5 g", label: "kg / 5 g (Retail counter · e = 5 g)" },
    { value: "kg", label: "kg (Kilograms)" },
    { value: "g / 0.1 g", label: "g / 0.1 g (High precision · e = 0.1 g)" },
    { value: "g / 1 g", label: "g / 1 g (Kitchen / lab · e = 1 g)" },
    { value: "g", label: "g (Grams)" },
    { value: "tonnes", label: "tonnes (Tonnes)" },
  ],
  "Platform Scale (Industrial)": [
    { value: "kg / 10 g", label: "kg / 10 g (Platform · e = 10 g)" },
    { value: "kg / 20 g", label: "kg / 20 g (Platform · e = 20 g)" },
    { value: "kg / 50 g", label: "kg / 50 g (Industrial · e = 50 g)" },
    { value: "kg", label: "kg (Kilograms)" },
    { value: "tonnes / 10 kg", label: "tonnes / 10 kg (Heavy industrial)" },
    { value: "Metric Tonnes", label: "Metric Tonnes" },
  ],
  "Weighbridge (Heavy Vehicle)": [
    { value: "Metric Tonnes", label: "Metric Tonnes (Standard heavy vehicle)" },
    { value: "tonnes / 10 kg", label: "tonnes / 10 kg (Class III · e = 10 kg)" },
    { value: "tonnes / 20 kg", label: "tonnes / 20 kg (Class III · e = 20 kg)" },
    { value: "tonnes", label: "tonnes (Tonnes)" },
    { value: "kg", label: "kg (Kilograms)" },
  ],
  "Fuel Dispenser (Petrol/Diesel)": [
    { value: "L/min", label: "L/min (Standard nozzle delivery)" },
    { value: "litres/min", label: "litres/min (Flow rate)" },
    { value: "L", label: "L (Fixed volume batch)" },
    { value: "mL", label: "mL (Micro dispenser)" },
  ],
  "Automatic Gravimetric Filling": [
    { value: "kg / 1 g", label: "kg / 1 g (Packaging scale · e = 1 g)" },
    { value: "kg / 5 g", label: "kg / 5 g (Bulk packaging · e = 5 g)" },
    { value: "kg", label: "kg (Kilograms)" },
    { value: "g / 0.1 g", label: "g / 0.1 g (Precision chemical/pharma)" },
    { value: "g", label: "g (Grams)" },
  ],
  "Commercial Length & Linear Measure": [
    { value: "m", label: "m (Metres · cloth/wire)" },
    { value: "cm", label: "cm (Centimetres)" },
    { value: "mm", label: "mm (Millimetres)" },
  ],
};

export const CATEGORY_QUICK_CAPACITIES: Record<InstrumentCategory, string[]> = {
  "Electronic Counter Scale": ["15 kg / 1 g", "30 kg / 2 g", "50 kg / 5 g", "5 kg / 1 g"],
  "Platform Scale (Industrial)": ["100 kg / 20 g", "300 kg / 50 g", "500 kg / 100 g", "1000 kg / 200 g"],
  "Weighbridge (Heavy Vehicle)": ["40 Metric Tonnes", "50 Metric Tonnes", "60 Metric Tonnes", "80 Metric Tonnes", "100 Metric Tonnes"],
  "Fuel Dispenser (Petrol/Diesel)": ["45 L/min", "50 L/min", "70 L/min", "50 L"],
  "Automatic Gravimetric Filling": ["5 kg / 1 g", "25 kg / 5 g", "50 kg / 10 g"],
  "Commercial Length & Linear Measure": ["1 m", "2 m", "5 m", "10 m", "30 m", "50 m"],
};

export function getCategoryUnits(category: string): CapacityUnitOption[] {
  return CATEGORY_UNITS[category as InstrumentCategory] ?? CATEGORY_UNITS["Electronic Counter Scale"];
}

export function getDefaultUnit(category: string): string {
  const units = getCategoryUnits(category);
  return units[0]?.value ?? "kg";
}

export function splitCapacityString(
  rawCapacity: string,
  category: string
): { magnitude: string; unit: string; isCustom: boolean } {
  const trimmed = rawCapacity.trim();
  if (!trimmed) {
    return { magnitude: "", unit: getDefaultUnit(category), isCustom: false };
  }

  const match = /^\s*(\d+(?:\.\d+)?)\s*(.*)$/.exec(trimmed);
  if (!match) {
    return { magnitude: "", unit: trimmed, isCustom: true };
  }

  const magnitude = match[1];
  const unit = match[2].trim();
  const available = getCategoryUnits(category);
  const found = available.some((u) => u.value.toLowerCase() === unit.toLowerCase());

  return {
    magnitude,
    unit: found ? available.find((u) => u.value.toLowerCase() === unit.toLowerCase())!.value : unit,
    isCustom: !found && Boolean(unit),
  };
}

export function assembleCapacity(magnitude: string, unit: string): string {
  const mag = magnitude.trim();
  const u = unit.trim();
  if (!mag && !u) return "";
  if (!u) return mag;
  if (!mag) return u;
  return `${mag} ${u}`;
}

const MASS_UNIT_RE = /\b(metric\s*tonnes?|tonnes?|t|kg|g|mg)\b/i;
const VOLUME_UNIT_RE = /\b(l\/min|litres?\/min|liters?\/min|l|ml|litres?|liters?)\b/i;
const LENGTH_UNIT_RE = /\b(metres?|meters?|m|cm|mm)\b/i;
const ANY_UNIT_RE = /\b(metric\s*tonnes?|tonnes?|t|kg|g|mg|l\/min|litres?\/min|liters?\/min|l|ml|litres?|liters?|metres?|meters?|m|cm|mm)\b/i;

/**
 * Capacity: must contain a numeric quantity and legal unit.
 * Scoped to category to avoid volume units for scales or mass units for pumps.
 * Rejects placeholder inputs like "1" or arbitrary non-unit text like "Hiten Darindaa".
 */
export function capacityError(raw: string, category?: string): string | null {
  const v = raw.trim();
  if (!v) return "Capacity is required";
  if (v.length < 2) return "Capacity must be at least 2 characters";
  if (v.length > 50) return "Capacity cannot exceed 50 characters";

  if (!/\d/.test(v)) {
    return "Capacity must include a numeric quantity (e.g. 15 kg / 1 g)";
  }

  if (/^\d+$/.test(v)) {
    return "Capacity must include a unit (e.g. 15 kg / 1 g, 45 L/min)";
  }

  const cat = (category ?? "").toLowerCase();
  const isVolume = cat.includes("fuel") || cat.includes("dispenser");
  const isLength = cat.includes("length") || cat.includes("linear");
  const isMass = cat.includes("scale") || cat.includes("weighbridge") || cat.includes("filling");

  if (isVolume) {
    if (!VOLUME_UNIT_RE.test(v)) {
      return "Fuel dispensers require volume or flow units (e.g. 45 L/min or 50 L)";
    }
  } else if (isLength) {
    if (!LENGTH_UNIT_RE.test(v)) {
      return "Linear measures require length units (e.g. 30 m, 100 cm)";
    }
  } else if (isMass) {
    if (!MASS_UNIT_RE.test(v)) {
      return "Weighing instruments require mass units (e.g. 15 kg / 1 g, 60 Metric Tonnes)";
    }
  } else {
    if (!ANY_UNIT_RE.test(v)) {
      return "Include a recognized unit (e.g. kg, g, tonnes, L/min, m)";
    }
  }

  return null;
}

/**
 * Location is optional, but if provided, must be a realistic description.
 * Rejects single characters like "1".
 */
export function locationError(raw?: string): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (v.length < 2) return "Location must be at least 2 characters if specified";
  if (v.length > 80) return "Location cannot exceed 80 characters";
  if (/^\d+$/.test(v)) return "Enter a descriptive location (e.g. Counter 2, Island 1)";
  return null;
}

export function instrumentErrors(i: InstrumentInput): Record<InstrumentField, string | null> {
  return {
    serialNumber: serialNumberError(i.serialNumber),
    category: categoryError(i.category),
    model: modelError(i.model),
    capacity: capacityError(i.capacity, i.category),
    location: locationError(i.location),
  };
}

export function firstInstrumentError(
  i: InstrumentInput
): { field: InstrumentField; error: string } | null {
  const errors = instrumentErrors(i);
  for (const [field, error] of Object.entries(errors) as Array<[InstrumentField, string | null]>) {
    if (error) return { field, error };
  }
  return null;
}

/**
 * An instrument cannot be deleted if it has an in-progress verification application.
 */
export function instrumentDeletionError(
  activeApplications: Array<{ applicationNumber?: string; status: string }>
): string | null {
  const active = activeApplications.find((a) => ["SUBMITTED", "ASSIGNED"].includes(a.status));
  if (active) {
    const appNum = active.applicationNumber ? ` (${active.applicationNumber})` : "";
    return `Cannot delete instrument while verification application${appNum} is in progress. Cancel or conclude the application first.`;
  }
  return null;
}

