"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  CameraOff,
  Loader2,
  X,
  ScanLine,
  AlertCircle,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSearch,
  Sparkles,
  ClipboardPaste,
} from "lucide-react";
import jsQR from "jsqr";
import { Button, cx } from "@/components/ui";

type Phase = "idle" | "starting" | "scanning" | "denied" | "unsupported" | "error";
type TabMode = "camera" | "upload" | "samples";

interface DemoTokens {
  validToken?: string;
  expiredToken?: string;
  tamperedToken?: string;
}

export default function QrScanner({
  open,
  onClose,
  onResult,
  demoTokens: initialDemoTokens,
}: {
  open: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
  demoTokens?: DemoTokens;
}) {
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const doneRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [tab, setTab] = useState<TabMode>("camera");
  const [message, setMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [demoTokens, setDemoTokens] = useState<DemoTokens | undefined>(initialDemoTokens);
  const [isDecoding, setIsDecoding] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch demo tokens if not provided
  useEffect(() => {
    if (demoTokens?.validToken) return;
    fetch("/api/demo-tokens")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setDemoTokens({
            validToken: data.validToken,
            expiredToken: data.expiredToken,
            tamperedToken: data.tamperedToken,
          });
        }
      })
      .catch(() => {});
  }, [demoTokens]);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const decodeImageData = useCallback(
    (canvas: HTMLCanvasElement): string | null => {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });
      return code?.data ? code.data.trim() : null;
    },
    []
  );

  const decodeFile = useCallback(
    (file: File) => {
      setIsDecoding(true);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const result = decodeImageData(canvas);
            setIsDecoding(false);
            if (result) {
              stopCamera();
              onResult(result);
              return;
            }
          }
          setIsDecoding(false);
          alert("No QR code detected in this image. Please ensure the QR code is clear and well lit, or test with a sample.");
        };
        img.onerror = () => {
          setIsDecoding(false);
          alert("Could not load image. Please select a valid PNG or JPEG image.");
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [decodeImageData, onResult, stopCamera]
  );

  // Clipboard paste support (Ctrl+V)
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            decodeFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open, decodeFile]);

  // Start / Stop camera based on open state and active tab
  useEffect(() => {
    if (!open || tab !== "camera") {
      stopCamera();
      if (open && tab !== "camera") setPhase("idle");
      return;
    }

    doneRef.current = false;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("unsupported");
        setMessage("Camera is not available on this browser. Upload a QR sticker photo or test with a sample below.");
        setTab("upload");
        return;
      }

      setPhase("starting");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setPhase("scanning");

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = () => {
          if (cancelled || doneRef.current) return;
          try {
            if (video.readyState >= 2 && ctx && video.videoWidth > 0 && video.videoHeight > 0) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth",
              });
              if (code && code.data) {
                const raw = code.data.trim();
                if (raw) {
                  doneRef.current = true;
                  stopCamera();
                  onResult(raw);
                  return;
                }
              }
            }
          } catch {
            /* ignore dropped frame */
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setPhase("denied");
          setMessage("Camera permission was denied. You can easily upload a QR photo or test with samples.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setPhase("error");
          setMessage("No camera detected on this PC/device. Upload a photo or test below.");
        } else {
          setPhase("error");
          setMessage("Camera could not be started. Use photo upload or test with samples.");
        }
        setTab("upload");
      }
    }

    const timer = setTimeout(() => void start(), 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopCamera();
    };
  }, [open, tab, onResult, stopCamera]);

  if (!open || !mounted) return null;

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleSampleClick = (token?: string) => {
    if (!token) return;
    stopCamera();
    onResult(token);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm animate-fade-in sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Scan QR Sticker"
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950 text-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-seal-500/20 text-seal-400">
              <ScanLine className="h-4 w-4" />
            </span>
            <div>
              <span className="text-[15px] font-semibold text-white">Verify Certificate QR</span>
              <p className="text-[11px] text-white/50">HMAC-SHA256 authenticated</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white focus-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode switcher tabs */}
        <div className="flex border-b border-white/10 bg-white/[0.03] p-1.5 text-xs">
          <button
            type="button"
            onClick={() => setTab("camera")}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition",
              tab === "camera"
                ? "bg-seal-600 text-white shadow-sm"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <Camera className="h-3.5 w-3.5" />
            Live Camera
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition",
              tab === "upload"
                ? "bg-seal-600 text-white shadow-sm"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Photo
          </button>
          <button
            type="button"
            onClick={() => setTab("samples")}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition",
              tab === "samples"
                ? "bg-seal-600 text-white shadow-sm"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Demo Samples
          </button>
        </div>

        {/* Tab 1: Live Camera View */}
        {tab === "camera" && (
          <div className="relative aspect-[4/3] w-full bg-black sm:aspect-square sm:max-h-[340px]">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cx(
                "h-full w-full object-cover",
                phase === "scanning" ? "opacity-100" : "opacity-0"
              )}
            />

            {phase === "scanning" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-[65%] w-[65%] max-w-[240px]">
                  {[
                    "left-0 top-0 border-l-4 border-t-4 rounded-tl-xl",
                    "right-0 top-0 border-r-4 border-t-4 rounded-tr-xl",
                    "left-0 bottom-0 border-b-4 border-l-4 rounded-bl-xl",
                    "right-0 bottom-0 border-b-4 border-r-4 rounded-br-xl",
                  ].map((c) => (
                    <span key={c} className={cx("absolute h-8 w-8 border-seal-400", c)} />
                  ))}
                  <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-seal-400/70 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
                </div>
              </div>
            )}

            {phase !== "scanning" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                {phase === "starting" ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-seal-400" />
                    <p className="text-sm font-medium text-white/90">Starting camera…</p>
                  </>
                ) : (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                      {phase === "denied" ? (
                        <CameraOff className="h-6 w-6 text-amber-300" />
                      ) : (
                        <AlertCircle className="h-6 w-6 text-amber-300" />
                      )}
                    </span>
                    <p className="text-[15px] font-semibold text-white">
                      {phase === "denied" ? "Camera permission required" : "No camera detected"}
                    </p>
                    <p className="max-w-xs text-xs leading-relaxed text-white/60">
                      {message || "You can upload a photo of the QR sticker or test using sample tokens."}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Upload}
                        onClick={() => setTab("upload")}
                      >
                        Upload QR photo
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Sparkles}
                        onClick={() => setTab("samples")}
                        className="text-white hover:bg-white/10"
                      >
                        Test samples
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Upload Photo / Drag & Drop */}
        {tab === "upload" && (
          <div className="p-5">
            {message && (phase === "unsupported" || phase === "denied" || phase === "error") && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <span className="font-medium">Camera not active: </span>
                  {message}
                </div>
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) decodeFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cx(
                "group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition-all",
                dragOver
                  ? "border-seal-400 bg-seal-500/10 scale-[0.99]"
                  : "border-white/15 bg-white/[0.02] hover:border-seal-400/60 hover:bg-white/[0.04]"
              )}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-seal-500/15 text-seal-300 transition group-hover:scale-105 group-hover:bg-seal-500/25">
                {isDecoding ? (
                  <Loader2 className="h-6 w-6 animate-spin text-seal-400" />
                ) : (
                  <ImageIcon className="h-6 w-6" />
                )}
              </span>
              <p className="mt-3 text-sm font-semibold text-white">
                {isDecoding ? "Reading QR code…" : "Click or drag & drop a QR image"}
              </p>
              <p className="mt-1 text-xs text-white/50">
                PNG, JPG, WebP from photo gallery, camera, or screenshots
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] text-white/70">
                <ClipboardPaste className="h-3 w-3" /> Press Ctrl + V to paste
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-white/50">Evaluating on desktop?</span>
              <button
                type="button"
                onClick={() => setTab("samples")}
                className="inline-flex items-center gap-1 text-xs font-medium text-seal-300 hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Try with 1-click sample certificates →
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Demo Samples */}
        {tab === "samples" && (
          <div className="space-y-3 p-5">
            <p className="text-xs text-white/60">
              Select any pre-signed certificate below to test the verification pipeline without scanning a physical sticker:
            </p>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => handleSampleClick(demoTokens?.validToken)}
                className="group flex items-start gap-3 rounded-xl border border-seal-500/30 bg-seal-950/40 p-3 text-left transition hover:border-seal-400 hover:bg-seal-900/50 focus-ring"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-seal-500/20 text-seal-300">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-white">Genuine Certificate</span>
                    <span className="rounded bg-seal-500/20 px-1.5 py-0.5 text-[10px] font-medium text-seal-300">
                      Valid
                    </span>
                  </div>
                  <p className="text-xs text-white/60">
                    Electronic Counter Scale at ABC Traders. Valid HMAC signature.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSampleClick(demoTokens?.expiredToken)}
                className="group flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-left transition hover:border-amber-400 hover:bg-amber-900/40 focus-ring"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-white">Expired Certificate</span>
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                      Lapsed
                    </span>
                  </div>
                  <p className="text-xs text-white/60">
                    Fuel Dispenser at ABC Traders. Authentic signature, but validity window lapsed.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSampleClick(demoTokens?.tamperedToken)}
                className="group flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-left transition hover:border-rose-400 hover:bg-rose-900/40 focus-ring"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300">
                  <XCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-white">Tampered Certificate</span>
                    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                      Tampered
                    </span>
                  </div>
                  <p className="text-xs text-white/60">
                    Modified payload (capacity altered) — cryptographically fails HMAC verification.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) decodeFile(file);
          }}
        />

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <Camera className="h-3.5 w-3.5 shrink-0 text-seal-400" />
            <span>Decoded securely on your device</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-white/60 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
