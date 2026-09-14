/**
 * Turns a reverse-geocoded location into a postal-style premises address, and
 * fetches one for the browser. The formatter is pure so it can be tested; the
 * lookup goes through our own /api/geocode/reverse, never straight to the
 * provider, so requests are rate-limited, cached and identified properly.
 */

/** The address parts OpenStreetMap Nominatim returns (all optional). */
export interface OsmAddress {
  shop?: string;
  amenity?: string;
  building?: string;
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
}

export const ADDRESS_MAX = 300;

/**
 * "Shop 14, Main Market, Connaught Place, New Delhi, Delhi 110001" — most
 * specific first, repeats dropped (OSM often names the same place as both
 * suburb and city district), postcode attached to the state as on Indian mail.
 */
export function formatPremisesAddress(a: OsmAddress, placeName?: string | null): string {
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const locality = a.city ?? a.town ?? a.village;
  const region = [a.state, a.postcode].filter(Boolean).join(" ");

  const parts = [
    placeName ?? a.shop ?? a.amenity ?? a.building,
    street,
    a.neighbourhood ?? a.quarter,
    a.suburb,
    a.city_district,
    locality,
    a.state_district,
    region,
  ];

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of parts) {
    const p = (raw ?? "").trim();
    if (!p || seen.has(p.toLowerCase())) continue;
    seen.add(p.toLowerCase());
    unique.push(p);
  }
  // Drop a part another part already contains, wherever it appears ("Delhi"
  // beside "Central Delhi" or "Delhi 110005").
  const kept = unique.filter((p) => {
    const lp = p.toLowerCase();
    return !unique.some((q) => q.toLowerCase() !== lp && q.toLowerCase().includes(lp));
  });
  return kept.join(", ").slice(0, ADDRESS_MAX);
}

export type AddressLookup = { ok: true; address: string } | { ok: false; error: string };

/** Browser helper: the premises address at a point, via our server. */
export async function lookupAddress(lat: number, lng: number): Promise<AddressLookup> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
    const data = await res.json();
    return data.success ? { ok: true, address: data.address } : { ok: false, error: data.error || "Address lookup failed" };
  } catch {
    return { ok: false, error: "Couldn't look up the address — check your connection, or type it in" };
  }
}
