"use client";

import React, { useState } from "react";
import { PackagePlus, AlertCircle, Zap } from "lucide-react";
import { Button, Label, Modal, Notice, cx } from "@/components/ui";
import {
  INSTRUMENT_CATEGORIES,
  instrumentErrors,
  firstInstrumentError,
  type InstrumentField,
} from "@/lib/instrument-validation";

interface RegisterInstrumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** "ABC Traders · ABC-DL-2024-9871" — shown under the title. */
  businessLabel?: string;
}

const CATEGORIES = INSTRUMENT_CATEGORIES;

const PRESETS = [
  {
    label: "Counter scale",
    category: "Electronic Counter Scale",
    serialPrefix: "SCALE-2024",
    model: "Mettler Toledo FreshWay",
    capacity: "15 kg / 1 g",
    location: "Counter 2 – Express",
  },
  {
    label: "Weighbridge · 60 t",
    category: "Weighbridge (Heavy Vehicle)",
    serialPrefix: "WB-DL",
    model: "Avery Weigh-Tronix BridgeMaster",
    capacity: "60 Metric Tonnes",
    location: "Logistics Yard, Gate 1",
  },
  {
    label: "Fuel dispenser",
    category: "Fuel Dispenser (Petrol/Diesel)",
    serialPrefix: "FD-CP",
    model: "Tokheim Quantium 510",
    capacity: "45 L/min",
    location: "Island 3 – Diesel",
  },
];

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[12px] text-rose-700">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

/** Three-digit suffix so repeated demo runs never collide on the unique serial. */
const randomSuffix = () => Math.floor(100 + Math.random() * 900);

export default function RegisterInstrumentModal({
  isOpen,
  onClose,
  onSuccess,
  businessLabel,
}: RegisterInstrumentModalProps) {
  const [serialNumber, setSerialNumber] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [model, setModel] = useState("");
  const [capacity, setCapacity] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badField, setBadField] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<InstrumentField, boolean>>>({});
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const errors = instrumentErrors({ serialNumber, category, model, capacity, location });
  const show = (k: InstrumentField) => (touched[k] ? errors[k] : null);
  const invalid = (k: InstrumentField) => Boolean(show(k)) || badField === k;
  const fieldClass = (k: InstrumentField, extra = "") =>
    cx("field", extra, invalid(k) && "border-rose-500 focus:border-rose-500");

  const blur = (k: InstrumentField) => () => setTouched((t) => ({ ...t, [k]: true }));

  const clearBad = (k: string) => {
    if (badField === k) {
      setBadField(null);
      setError(null);
    }
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setCategory(p.category);
    setSerialNumber(`${p.serialPrefix}-${randomSuffix()}`);
    setModel(p.model);
    setCapacity(p.capacity);
    setLocation(p.location);
    setActivePreset(p.label);
    setError(null);
    setBadField(null);
    setTouched({});
  };

  const reset = () => {
    setSerialNumber("");
    setModel("");
    setCapacity("");
    setLocation("");
    setActivePreset(null);
    setError(null);
    setBadField(null);
    setTouched({});
  };

  const touchAll = () =>
    setTouched({
      serialNumber: true,
      category: true,
      model: true,
      capacity: true,
      location: true,
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    touchAll();
    const firstErr = firstInstrumentError({ serialNumber, category, model, capacity, location });
    if (firstErr) {
      setError(firstErr.error);
      setBadField(firstErr.field);
      return;
    }

    setLoading(true);
    setError(null);
    setBadField(null);
    try {
      const res = await fetch("/api/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The server attaches the instrument to the signed-in business.
        body: JSON.stringify({ serialNumber, category, model, capacity, location }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBadField(data.field ?? null);
        throw new Error(data.error || "Failed to register instrument");
      }
      onSuccess();
      onClose();
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const isVolume = category.toLowerCase().includes("fuel") || category.toLowerCase().includes("dispenser");
  const isLength = category.toLowerCase().includes("length") || category.toLowerCase().includes("linear");
  const capacityHint = isVolume
    ? "e.g. 45 L/min or 50 L"
    : isLength
      ? "e.g. 30 m or 100 cm"
      : "e.g. 15 kg / 1 g or 60 tonnes";

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      icon={PackagePlus}
      title="Register instrument"
      subtitle={businessLabel}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="register-instrument" loading={loading}>
            Register instrument
          </Button>
        </>
      }
    >
      {/* Quick-fill presets */}
      <div className="border-b border-line bg-ink-50/60 px-6 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-500">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          Quick fill
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className={cx(
                "rounded-lg border px-2.5 py-1 text-[13px] font-medium transition focus-ring",
                activePreset === p.label
                  ? "border-seal-300 bg-seal-50 text-seal-800"
                  : "border-line-strong bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <form id="register-instrument" onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        {error && (
          <Notice tone="bad" icon={AlertCircle}>
            {error}
          </Notice>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="serial">Serial number</Label>
            <input
              id="serial"
              type="text"
              required
              maxLength={30}
              value={serialNumber}
              onChange={(e) => {
                setSerialNumber(e.target.value.toUpperCase());
                clearBad("serialNumber");
              }}
              onBlur={blur("serialNumber")}
              placeholder="SCALE-2024-002"
              className={fieldClass("serialNumber", "font-mono")}
              aria-invalid={invalid("serialNumber") || undefined}
              aria-describedby={show("serialNumber") ? "serial-error" : undefined}
            />
            <FieldError id="serial-error" message={show("serialNumber")} />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                clearBad("category");
              }}
              onBlur={blur("category")}
              className={fieldClass("category")}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <FieldError id="category-error" message={show("category")} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="model">Make / model</Label>
            <input
              id="model"
              type="text"
              required
              maxLength={60}
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                clearBad("model");
              }}
              onBlur={blur("model")}
              placeholder="Essae DS-215 Precision"
              className={fieldClass("model")}
              aria-invalid={invalid("model") || undefined}
              aria-describedby={show("model") ? "model-error" : undefined}
            />
            <FieldError id="model-error" message={show("model")} />
          </div>
          <div>
            <Label htmlFor="capacity" hint={capacityHint}>
              Capacity
            </Label>
            <input
              id="capacity"
              type="text"
              required
              maxLength={50}
              value={capacity}
              onChange={(e) => {
                setCapacity(e.target.value);
                clearBad("capacity");
              }}
              onBlur={blur("capacity")}
              placeholder={isVolume ? "45 L/min" : isLength ? "30 m" : "50 kg / 1 g"}
              className={fieldClass("capacity")}
              aria-invalid={invalid("capacity") || undefined}
              aria-describedby={show("capacity") ? "capacity-error" : undefined}
            />
            <FieldError id="capacity-error" message={show("capacity")} />
          </div>
        </div>

        <div>
          <Label htmlFor="location" hint="optional">
            Location / counter
          </Label>
          <input
            id="location"
            type="text"
            maxLength={80}
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              clearBad("location");
            }}
            onBlur={blur("location")}
            placeholder="Counter 2 – Retail billing"
            className={fieldClass("location")}
            aria-invalid={invalid("location") || undefined}
            aria-describedby={show("location") ? "location-error" : undefined}
          />
          <FieldError id="location-error" message={show("location")} />
        </div>
      </form>
    </Modal>
  );
}
