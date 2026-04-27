// PT-BR region label per ISO3, derived from the world-countries subregion.
// Falls back to "Outros" for codes we don't recognize.
import countries from "world-countries";

const SUBREGION_PT: Record<string, string> = {
  "North America": "América do Norte",
  "South America": "América do Sul",
  "Central America": "América Central",
  "Caribbean": "Caribe",
  "Northern Europe": "Europa",
  "Western Europe": "Europa",
  "Southern Europe": "Europa",
  "Eastern Europe": "Europa",
  "Central Europe": "Europa",
  "Southeast Europe": "Europa",
  "Eastern Asia": "Ásia",
  "Southern Asia": "Ásia",
  "South-Eastern Asia": "Ásia",
  "Central Asia": "Ásia",
  "Western Asia": "Oriente Médio",
  "Northern Africa": "África",
  "Eastern Africa": "África",
  "Western Africa": "África",
  "Middle Africa": "África",
  "Southern Africa": "África",
  "Australia and New Zealand": "Oceania",
  "Polynesia": "Oceania",
  "Melanesia": "Oceania",
  "Micronesia": "Oceania",
};

const REGION_BY_ISO3 = new Map<string, string>();
for (const c of countries) {
  const subregion = c.subregion || "";
  REGION_BY_ISO3.set(c.cca3, SUBREGION_PT[subregion] ?? "Outros");
}

export function regionFor(iso3: string | null | undefined): string {
  if (!iso3) return "Outros";
  return REGION_BY_ISO3.get(iso3) ?? "Outros";
}
