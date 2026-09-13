"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Scale,
  BadgeCheck,
  Building2,
  FileText,
  ArrowUpRight,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/session-types";
import {
  Badge,
  Card,
  EmptyState,
  LoadingState,
  Mono,
  Segmented,
  Spinner,
  cx,
  type Tone,
} from "@/components/ui";

interface SearchHit {
  kind: "instrument" | "certificate" | "business" | "application";
  id: string;
  title: string;
  subtitle: string;
  meta: string[];
  href?: string;
  status?: { label: string; tone: Tone };
}

interface SearchData {
  query: string;
  scope: "own" | "jurisdiction";
  counts: Record<SearchHit["kind"], number>;
  hits: SearchHit[];
  tooShort?: boolean;
}

type Filter = "ALL" | SearchHit["kind"];

const KIND_ICON: Record<SearchHit["kind"], LucideIcon> = {
  instrument: Scale,
  certificate: BadgeCheck,
  business: Building2,
  application: FileText,
};

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  instrument: "Instruments",
  certificate: "Certificates",
  business: "Businesses",
  application: "Applications",
};

const EXAMPLES = ["SCALE-2024", "CERT-LM", "Sharma", "WB-DL", "Connaught"];

export default function SearchView({ initialQuery, role }: { initialQuery: string; role: Role }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const mine = ++seq.current;
    if (q.trim().length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const d = await res.json();
      // Ignore a slow response that a newer keystroke has already superseded.
      if (mine !== seq.current) return;
      setData(d.success ? d : null);
    } catch (e) {
      console.error(e);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  // Debounced search as you type, and keep the URL shareable.
  useEffect(() => {
    const id = window.setTimeout(() => {
      void runSearch(query);
      const url = query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : "/search";
      window.history.replaceState(null, "", url);
    }, 250);
    return () => window.clearTimeout(id);
  }, [query, runSearch]);

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const total = data ? data.hits.length : 0;
  const visible = data ? (filter === "ALL" ? data.hits : data.hits.filter((h) => h.kind === filter)) : [];
  const kinds = (["instrument", "certificate", "application", "business"] as const).filter(
    (k) => (data?.counts[k] ?? 0) > 0
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="eyebrow">Search &amp; retrieval</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-[28px]">
          Find any instrument, certificate or application
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-500">
          {role === "BUSINESS"
            ? "Searches your own register."
            : "Searches the whole jurisdiction — every business, instrument and certificate on record."}
        </p>
      </div>

      <div className="sticky top-[4.25rem] z-10">
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-2 shadow-lift">
          <Search className="ml-2 h-5 w-5 shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Serial number, certificate number, business, application…"
            className="h-11 w-full border-0 bg-transparent text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
          {loading && <Spinner className="mr-1 h-4 w-4 text-ink-400" />}
          {query && !loading && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="mr-1 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-800 focus-ring"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!query.trim() ? (
        <Card className="p-6">
          <div className="text-[13px] font-medium text-ink-700">Try one of these</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setQuery(e)}
                className="rounded-lg border border-line-strong bg-white px-2.5 py-1 font-mono text-[13px] text-ink-700 transition hover:border-seal-400 hover:bg-seal-50/50 focus-ring"
              >
                {e}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
            Every certificate found here opens the same public verification page a shopper
            reaches by scanning the QR sticker, so a field check and an office lookup end at the
            same signed record.
          </p>
        </Card>
      ) : query.trim().length < 2 ? (
        <Card>
          <EmptyState compact icon={Search} title="Keep typing" body="Enter at least two characters." />
        </Card>
      ) : loading && !data ? (
        <Card>
          <LoadingState label="Searching the register" />
        </Card>
      ) : total === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={Search}
            title={`Nothing matches “${query.trim()}”`}
            body="Check the serial or certificate number, or search by business name instead."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented<Filter>
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "ALL", label: `All · ${total}` },
                ...kinds.map((k) => ({ value: k as Filter, label: `${KIND_LABEL[k]} · ${data!.counts[k]}` })),
              ]}
            />
            <span className="text-xs text-ink-500">
              {data!.scope === "own" ? "Your register" : "Jurisdiction-wide"}
            </span>
          </div>

          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {visible.map((hit) => {
                const Icon = KIND_ICON[hit.kind];
                const body = (
                  <div className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Mono chip className="font-semibold">{hit.title}</Mono>
                        {hit.status && (
                          <Badge tone={hit.status.tone} dot>
                            {hit.status.label}
                          </Badge>
                        )}
                        <span className="text-[11px] uppercase tracking-wider text-ink-400">
                          {hit.kind}
                        </span>
                      </div>
                      <div className="mt-1 text-[14px] text-ink-800">{hit.subtitle}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                        {hit.meta.filter(Boolean).map((m, i) => (
                          <span key={i}>{m}</span>
                        ))}
                      </div>
                    </div>
                    {hit.href && (
                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-seal-600" />
                    )}
                  </div>
                );
                return (
                  <li key={`${hit.kind}-${hit.id}`}>
                    {hit.href ? (
                      <Link href={hit.href} className="group block px-5 py-4 transition-colors hover:bg-ink-50 focus-ring">
                        {body}
                      </Link>
                    ) : (
                      <div className="px-5 py-4">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <p className="text-center text-xs text-ink-400">
            Showing up to twelve matches per category. Narrow the query to see more precise results.
          </p>
        </>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={() => router.push("/")}
          className={cx("text-[13px] font-medium text-ink-500 transition hover:text-ink-900 focus-ring")}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
