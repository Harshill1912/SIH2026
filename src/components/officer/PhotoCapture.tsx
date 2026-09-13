"use client";

import React, { useRef, useState } from "react";
import { Camera, X, Loader2, AlertCircle, Upload } from "lucide-react";
import { compressImage, formatBytes, type CompressedImage } from "@/lib/image";
import { Label, cx } from "@/components/ui";

export interface PhotoValue extends CompressedImage {
  name: string;
}

/**
 * Lead-seal photo. On a phone the input opens the rear camera directly;
 * on a laptop it opens a file picker. The image is downscaled and re-encoded
 * client-side before it ever leaves the device.
 */
export default function PhotoCapture({
  value,
  onChange,
}: {
  value: PhotoValue | null;
  onChange: (v: PhotoValue | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const out = await compressImage(file);
      onChange({ ...out, name: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process that image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <Label hint="optional">Lead-seal photo</Label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div className="flex items-center gap-4 rounded-xl border border-line bg-white p-3 animate-fade-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.dataUrl}
            alt="Lead seal evidence"
            className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-line"
          />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-ink-900">{value.name}</div>
            <div className="mt-0.5 text-xs text-ink-500">
              {value.width}×{value.height} · {formatBytes(value.bytes)} after compression
            </div>
            <div className="mt-1 text-xs text-seal-700">Will be stored with the inspection record</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 focus-ring"
              title="Replace photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-lg p-2 text-ink-500 transition hover:bg-rose-50 hover:text-rose-700 focus-ring"
              title="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cx(
            "flex w-full items-center gap-4 rounded-xl border border-dashed p-4 text-left transition-colors focus-ring",
            busy
              ? "border-line bg-ink-50"
              : "border-line-strong bg-white hover:border-seal-400 hover:bg-seal-50/40"
          )}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-medium text-ink-900">
              {busy ? "Compressing photo…" : "Take or upload a photo of the seal"}
            </span>
            <span className="block text-xs text-ink-500">
              Opens the camera on a phone. Downscaled on-device before upload.
            </span>
          </span>
          <Upload className="ml-auto h-4 w-4 shrink-0 text-ink-400" />
        </button>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-700">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}
    </div>
  );
}
