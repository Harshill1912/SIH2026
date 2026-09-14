import { NextResponse } from "next/server";
import { clientKey, rateLimit, tooMany } from "@/lib/rate-limit";
import { formatPremisesAddress, type OsmAddress } from "@/lib/address";

/**
 * Reverse geocoding for the premises address: GPS point in, postal address out.
 *
 * Public, because a trader enrols before they have an account. Backed by
 * OpenStreetMap Nominatim, whose usage policy asks for an identifying
 * User-Agent, at most one request per second, caching, and attribution — all
 * handled here, which is why the browser never calls the provider directly.
 */

const PROVIDER = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "e-Metrology/1.0 (SIH26036 legal metrology prototype; https://github.com/Harshill1912/SIH2026)";
const ATTRIBUTION = "© OpenStreetMap contributors";

// Per server instance. Keyed to ~11 m, so re-captures at the same shop reuse one lookup.
const cache = new Map<string, { address: string; at: number }>();
const CACHE_TTL_MS = 24 * 60 * 60_000;
const CACHE_MAX = 500;

let lastCall = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "geocode"), 20, 10 * 60_000);
  if (!limit.ok) return tooMany(limit, "Too many address lookups. Please type the address in.");

  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ success: false, error: "Invalid location" }, { status: 400 });
  }

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, address: hit.address, attribution: ATTRIBUTION });
  }

  // One request per second to the provider, across everyone on this instance.
  const wait = lastCall + 1000 - Date.now();
  if (wait > 0) await sleep(Math.min(wait, 1000));
  lastCall = Date.now();

  let body: { address?: OsmAddress; name?: string; error?: string };
  try {
    const url = `${PROVIDER}?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-IN,en" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`provider ${res.status}`);
    body = await res.json();
  } catch (error) {
    console.error("Reverse geocode failed:", error);
    return NextResponse.json(
      { success: false, error: "Address lookup is unavailable right now — please type the address" },
      { status: 502 }
    );
  }

  const address = body.address ? formatPremisesAddress(body.address, body.name) : "";
  if (!address) {
    return NextResponse.json(
      { success: false, error: "No address found at this location — please type it in" },
      { status: 404 }
    );
  }

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { address, at: Date.now() });
  return NextResponse.json({ success: true, address, attribution: ATTRIBUTION });
}
