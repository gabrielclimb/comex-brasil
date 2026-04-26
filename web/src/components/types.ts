export type Mode = "exp" | "imp";
export type View = "globe" | "product" | "sankey" | "cypher";

export type Palette = {
  expHue: number;
  impHue: number;
};

export type PaletteId = "Indigo/Violeta" | "Esmeralda/Âmbar" | "Ciano/Magenta" | "Monochrome";

export const PALETTES: Record<PaletteId, Palette> = {
  "Indigo/Violeta": { expHue: 155, impHue: 290 },
  "Esmeralda/Âmbar": { expHue: 150, impHue: 70 },
  "Ciano/Magenta": { expHue: 195, impHue: 335 },
  Monochrome: { expHue: 220, impHue: 220 },
};

export type Tweaks = {
  palette: PaletteId;
  arcLift: number;
  arcOpacity: number;
  animSpeed: number;
  rotSpeed: number;
  showGraticule: boolean;
  showLabels: boolean;
  autoRotate: boolean;
};

export const DEFAULT_TWEAKS: Tweaks = {
  palette: "Indigo/Violeta",
  arcLift: 0.5,
  arcOpacity: 0.85,
  animSpeed: 1,
  rotSpeed: 0.08,
  showGraticule: true,
  showLabels: true,
  autoRotate: true,
};
