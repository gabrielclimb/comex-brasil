// Humanized formatters. All amounts are in base units (USD dollars, kg).

const USD = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
});

export function formatUSD(value: number): string {
  if (!isFinite(value) || value === 0) return "US$ 0";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `US$ ${(value / 1e9).toFixed(1).replace(".", ",")} B`;
  if (abs >= 1e6) return `US$ ${(value / 1e6).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1e3) return `US$ ${(value / 1e3).toFixed(0)} mil`;
  return USD.format(value);
}

export function formatTons(kg: number): string {
  if (!isFinite(kg) || kg === 0) return "0 t";
  const tons = kg / 1000;
  const abs = Math.abs(tons);
  if (abs >= 1e6) return `${(tons / 1e6).toFixed(1).replace(".", ",")} Mt`;
  if (abs >= 1e3) return `${(tons / 1e3).toFixed(1).replace(".", ",")} kt`;
  if (abs >= 1) return `${tons.toFixed(0)} t`;
  return `${kg.toFixed(0)} kg`;
}

export function formatPct(ratio: number): string {
  if (!isFinite(ratio)) return "—";
  if (ratio < 0.001) return "<0,1%";
  return `${(ratio * 100).toFixed(1).replace(".", ",")}%`;
}

// Map ISO3 to ISO2 for compact display (badges) and flag emoji rendering.
export function iso2For(iso3: string | null | undefined): string | null {
  if (!iso3) return null;
  return ISO3_TO_ISO2[iso3] ?? null;
}

const ISO3_TO_ISO2: Record<string, string> = {
  BRA: "BR", CHN: "CN", USA: "US", ARG: "AR", NLD: "NL", ESP: "ES",
  SGP: "SG", MEX: "MX", CHL: "CL", CAN: "CA", DEU: "DE", JPN: "JP",
  KOR: "KR", ITA: "IT", FRA: "FR", GBR: "GB", RUS: "RU", IND: "IN",
  TUR: "TR", IDN: "ID", THA: "TH", MYS: "MY", VNM: "VN", SAU: "SA",
  ARE: "AE", EGY: "EG", MAR: "MA", ZAF: "ZA", NGA: "NG", DZA: "DZ",
  COL: "CO", PER: "PE", URY: "UY", PRY: "PY", BOL: "BO", VEN: "VE",
  PRT: "PT", BEL: "BE", POL: "PL", SWE: "SE", CHE: "CH", NOR: "NO",
  DNK: "DK", FIN: "FI", AUT: "AT", IRL: "IE", GRC: "GR", ROU: "RO",
  UKR: "UA", HUN: "HU", CZE: "CZ", AUS: "AU", NZL: "NZ", HKG: "HK",
  TWN: "TW", PAK: "PK", BGD: "BD", PHL: "PH", LKA: "LK", IRN: "IR",
  IRQ: "IQ", ISR: "IL", JOR: "JO", LBN: "LB", KWT: "KW", OMN: "OM",
  QAT: "QA", BHR: "BH", YEM: "YE", ETH: "ET", KEN: "KE", GHA: "GH",
  CUB: "CU", DOM: "DO", GTM: "GT", PAN: "PA", CRI: "CR", HND: "HN",
  NIC: "NI", SLV: "SV", JAM: "JM", HTI: "HT", PRI: "PR",
};

export function flagFor(iso3: string | null | undefined): string {
  if (!iso3) return "🏳️";
  const iso2 = ISO3_TO_ISO2[iso3];
  if (!iso2) return "🏳️";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + iso2.charCodeAt(0) - 65, A + iso2.charCodeAt(1) - 65);
}
