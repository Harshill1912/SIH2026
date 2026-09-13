"use client";

import React, { useState } from "react";
import { PackagePlus, AlertCircle, Zap } from "lucide-react";
import { Button, Label, Modal, Notice, cx } from "@/components/ui";

interface RegisterInstrumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** "ABC Traders · ABC-DL-2024-9871" — shown under the title. */
  businessLabel?: string;
}

const CATEGORIES = [
  "Electronic Counter Scale",
  "Weighbridge (Heavy Vehicle)",
  "Fuel Dispenser (Petrol/Diesel)",
  "Platform Scale (Industrial)",
  "Automatic Gravimetric Filling",
  "Commercial Length & Linear Measure",
];

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

/** Three-digit suffix so repeated demo runs never collide on the unique serial. */
const randomSuffix = () => Math.floor(100 + Math.random() * 900);

export default function RegisterInstrumentModal({
  isOpen,
  onClose,
  onSuccess,
  businessLabel,
}: RegisterInstrumentModalProps) {
  const [serialNumber, setSerialNumber] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [model, setModel] = useState("");
  const [capacity, setCapacity] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setCategory(p.category);
    setSerialNumber(`${p.serialPrefix}-${randomSuffix()}`);
    setModel(p.model);
    setCapacity(p.capacity);
    setLocation(p.location);
    setActivePreset(p.label);
    setError(null);
  };

  const reset = () => {
    setSerialNumber("");
    setModel("");
    setCapacity("");
    setLocation("");
    setActivePreset(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The server attaches the instrument to the signed-in business.
        body: JSON.stringify({ serialNumber, category, model, capacity, location }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
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
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
              placeholder="SCALE-2024-002"
              className="field font-mono"
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="field"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="model">Make / model</Label>
            <input
              id="model"
              type="text"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Essae DS-215 Precision"
              className="field"
            />
          </div>
          <div>
            <Label htmlFor="capacity" hint="max / division">
              Capacity
            </Label>
            <input
              id="capacity"
              type="text"
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="50 kg / 1 g"
              className="field"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="location" hint="optional">
            Location / counter
          </Label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Counter 2 – Retail billing"
            className="field"
          />
        </div>
      </form>
    </Modal>
  );
}
