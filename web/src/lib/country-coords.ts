import countries from "world-countries";

// ISO3 -> [lat, lng] derived from the world-countries dataset.
// Falls back to the geographic centroid listed by the package.
const coordsByIso3 = new Map<string, [number, number]>();
for (const c of countries) {
  if (c.latlng && c.latlng.length === 2) {
    coordsByIso3.set(c.cca3, [c.latlng[0], c.latlng[1]]);
  }
}

// Comex Stat occasionally uses non-standard ISO3-like codes; patch the
// common mismatches that show up in Brazilian trade data.
const OVERRIDES: Record<string, [number, number]> = {
  CUW: [12.17, -68.99], // Curaçao
  SCG: [44.82, 20.46],  // ex-Sérvia e Montenegro (legacy flows)
  HKG: [22.32, 114.17], // Hong Kong (sometimes served separately)
  TWN: [23.69, 120.96],
  PSE: [31.95, 35.23],
  ROM: [45.94, 24.97],  // legacy code for Romania
};
for (const [iso3, latlng] of Object.entries(OVERRIDES)) {
  coordsByIso3.set(iso3, latlng);
}

export function coordsFor(iso3: string | null | undefined): [number, number] | null {
  if (!iso3) return null;
  return coordsByIso3.get(iso3) ?? null;
}

// Brasília — used as the shared origin for all arcs.
export const BRAZIL_CENTER: [number, number] = [-15.7939, -47.8828];
