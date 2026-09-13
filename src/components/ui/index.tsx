"use client";

import React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, type LucideIcon } from "lucide-react";

/* ── helpers ─────────────────────────────────────────────────────────── */

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "accent";

const toneBadge: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  good: "bg-seal-50 text-seal-800 ring-seal-200",
  warn: "bg-amber-50 text-amber-900 ring-amber-200",
  bad: "bg-rose-50 text-rose-800 ring-rose-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  accent: "bg-ink-900 text-white ring-ink-900",
};

const toneDot: Record<Tone, string> = {
  neutral: "bg-ink-400",
  good: "bg-seal-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  info: "bg-sky-500",
  accent: "bg-seal-400",
};

const toneText: Record<Tone, string> = {
  neutral: "text-ink-900",
  good: "text-seal-700",
  warn: "text-amber-600",
  bad: "text-rose-600",
  info: "text-sky-700",
  accent: "text-seal-700",
};

const toneIconWell: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-600",
  good: "bg-seal-50 text-seal-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-rose-50 text-rose-700",
  info: "bg-sky-50 text-sky-700",
  accent: "bg-ink-900 text-white",
};

/* ── Card ─────────────────────────────────────────────────────────────── */

export function Card({
  className,
  children,
  hover,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cx("card", hover && "card-hover", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-ink-500" />}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-ink-900">
            {title}
          </h2>
          {subtitle && (
            <p className="truncate text-[13px] text-ink-500">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Page header (per role) ───────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-[28px] sm:leading-tight">
          {title}
        </h1>
        {meta && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-500">
            {meta}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Stat tile ────────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  icon: LucideIcon;
  /** Colour the number, not just the icon well. Use for the one tile that matters. */
  emphasis?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="eyebrow">{label}</span>
        <span className={cx("rounded-lg p-1.5", toneIconWell[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span
          className={cx(
            "tnum text-[32px] font-semibold leading-none tracking-tight",
            emphasis ? toneText[tone] : "text-ink-900"
          )}
        >
          {value}
        </span>
        {hint && <span className="text-xs text-ink-500">{hint}</span>}
      </div>
    </Card>
  );
}

/* ── Badge ────────────────────────────────────────────────────────────── */

export function Badge({
  tone = "neutral",
  dot,
  pulse,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        toneBadge[tone],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={cx(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                toneDot[tone]
              )}
            />
          )}
          <span className={cx("relative inline-flex h-1.5 w-1.5 rounded-full", toneDot[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}

/* ── Button ───────────────────────────────────────────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "warn";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-ink-900 text-white hover:bg-ink-800 shadow-[0_1px_0_rgb(255_255_255/0.08)_inset]",
  secondary:
    "bg-white text-ink-800 border border-line-strong hover:border-ink-300 hover:bg-ink-50",
  ghost: "bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  accent: "bg-seal-600 text-white hover:bg-seal-700",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  warn: "bg-amber-500 text-white hover:bg-amber-600",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-[10px]",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,transform,box-shadow] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 focus-ring",
    variantClass[variant],
    sizeClass[size],
    extra
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : (
        Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      )}
      {children}
      {IconRight && !loading && (
        <IconRight className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      )}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
      {IconRight && <IconRight className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
    </Link>
  );
}

export function IconButton({
  icon: Icon,
  label,
  spinning,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  spinning?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong bg-white text-ink-600 transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900 active:scale-95 focus-ring",
        className
      )}
      {...rest}
    >
      <Icon className={cx("h-4 w-4", spinning && "animate-spin text-seal-600")} />
    </button>
  );
}

/* ── Segmented control ────────────────────────────────────────────────── */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: Array<{ value: T; label: React.ReactNode; icon?: LucideIcon; activeClass?: string }>;
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx(
        "inline-flex items-center rounded-[10px] border border-line bg-ink-50 p-1",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-lg font-medium transition-all duration-150 focus-ring",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              active
                ? cx("bg-white text-ink-900 shadow-card", o.activeClass)
                : "text-ink-500 hover:text-ink-800"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Notice (inline toast) ────────────────────────────────────────────── */

export function Notice({
  tone = "good",
  icon: Icon,
  children,
  action,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const ring: Record<Tone, string> = {
    neutral: "border-line bg-white text-ink-800",
    good: "border-seal-200 bg-seal-50 text-seal-900",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    bad: "border-rose-200 bg-rose-50 text-rose-950",
    info: "border-sky-200 bg-sky-50 text-sky-950",
    accent: "border-ink-900 bg-ink-900 text-white",
  };
  return (
    <div
      role="status"
      className={cx(
        "flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-up sm:flex-row sm:items-center sm:justify-between",
        ring[tone],
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
        <div>{children}</div>
      </div>
      {action}
    </div>
  );
}

/* ── Empty & loading states ───────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx("flex flex-col items-center text-center", compact ? "px-6 py-12" : "px-6 py-20")}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-ink-50 text-ink-400">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-ink-900">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="loading-bar mx-auto w-40 rounded-full" />
      <p className="mt-4 text-[13px] text-ink-500">{label}</p>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className ?? "h-4 w-4"
      )}
    />
  );
}

/* ── Modal ────────────────────────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  tone = "neutral",
  children,
  footer,
  width = "max-w-lg",
  header,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  /** Replace the default header entirely (e.g. the certificate's coloured band). */
  header?: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink-950/60 p-4 backdrop-blur-sm animate-fade-in sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        className={cx(
          "relative my-auto flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-modal animate-scale-in sm:max-h-[82vh]",
          width
        )}
      >
        {header ? (
          <div className="shrink-0">{header}</div>
        ) : (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line bg-white px-6 py-5">
            <div className="flex items-center gap-3">
              {Icon && (
                <span className={cx("rounded-xl p-2.5", toneIconWell[tone])}>
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <div>
                <h3 className="text-[17px] font-semibold tracking-tight text-ink-900">
                  {title}
                </h3>
                {subtitle && <p className="text-[13px] text-ink-500">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-800 focus-ring"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto bg-white">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-ink-50/70 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ── Small typographic helpers ────────────────────────────────────────── */

export function Mono({
  children,
  className,
  chip,
}: {
  children: React.ReactNode;
  className?: string;
  chip?: boolean;
}) {
  return (
    <span
      className={cx(
        "font-mono text-[13px] tracking-tight",
        chip && "rounded-md border border-line bg-ink-50 px-1.5 py-0.5 text-ink-800",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[13px] font-medium text-ink-700">{children}</span>
      {hint && <span className="text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

export function KV({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-ink-500">{label}</div>
      <div className={cx("mt-0.5 text-sm font-medium text-ink-900", mono && "font-mono text-[13px]")}>
        {value}
      </div>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px w-full bg-line", className)} />;
}
