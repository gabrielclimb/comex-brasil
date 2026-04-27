"use client";

import { useEffect, useMemo, useState } from "react";
import { LAND_POLYGONS } from "@/lib/land";
import type { Mode, Palette } from "@/components/types";
import type { Partner } from "@/app/api/partners/route";

// ---------- Math ----------
function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

type Projected = { x: number; y: number; z: number; visible: boolean };

function project(lat: number, lng: number, rotLng: number, rotLat: number, R: number): Projected {
  const phi = deg2rad(lat);
  const lambda = deg2rad(lng + rotLng);
  const phi0 = deg2rad(rotLat);

  let x = Math.cos(phi) * Math.sin(lambda);
  let y = Math.sin(phi);
  let z = Math.cos(phi) * Math.cos(lambda);

  // Tilt around X axis by -phi0
  const cy = Math.cos(-phi0);
  const sy = Math.sin(-phi0);
  const y2 = y * cy - z * sy;
  const z2 = y * sy + z * cy;
  y = y2;
  z = z2;

  return { x: x * R, y: -y * R, z, visible: z > -0.05 };
}

function arcPath(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  rotLng: number,
  rotLat: number,
  R: number,
  lift = 0.35,
  samples = 48,
): { pts: Projected[]; anyVisible: boolean } {
  const aLat = deg2rad(a.lat);
  const aLng = deg2rad(a.lng);
  const bLat = deg2rad(b.lat);
  const bLng = deg2rad(b.lng);
  const ax = Math.cos(aLat) * Math.cos(aLng);
  const ay = Math.sin(aLat);
  const az = Math.cos(aLat) * Math.sin(aLng);
  const bx = Math.cos(bLat) * Math.cos(bLng);
  const by = Math.sin(bLat);
  const bz = Math.cos(bLat) * Math.sin(bLng);
  const dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega) || 1e-6;

  const pts: Projected[] = [];
  let anyVisible = false;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const s1 = Math.sin((1 - t) * omega) / sinOmega;
    const s2 = Math.sin(t * omega) / sinOmega;
    const px = s1 * ax + s2 * bx;
    const py = s1 * ay + s2 * by;
    const pz = s1 * az + s2 * bz;
    const lat = (Math.asin(py) * 180) / Math.PI;
    const lng = (Math.atan2(pz, px) * 180) / Math.PI;
    const h = 1 + lift * Math.sin(t * Math.PI);
    const p = project(lat, lng, rotLng, rotLat, R * h);
    pts.push(p);
    if (p.visible) anyVisible = true;
  }
  return { pts, anyVisible };
}

function pointsToPath(pts: Projected[], splitOnHidden = false): string {
  let d = "";
  let drawing = false;
  for (const p of pts) {
    if (splitOnHidden && !p.visible) {
      drawing = false;
      continue;
    }
    if (!drawing) {
      d += `M${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
      drawing = true;
    } else {
      d += `L${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
    }
  }
  return d;
}

function graticule(rotLng: number, rotLat: number, R: number): Projected[][] {
  const lines: Projected[][] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts: Projected[] = [];
    for (let lng = -180; lng <= 180; lng += 4) {
      pts.push(project(lat, lng, rotLng, rotLat, R));
    }
    lines.push(pts);
  }
  for (let lng = -180; lng < 180; lng += 30) {
    const pts: Projected[] = [];
    for (let lat = -80; lat <= 80; lat += 4) {
      pts.push(project(lat, lng, rotLng, rotLat, R));
    }
    lines.push(pts);
  }
  return lines;
}

// ---------- Component ----------
export type GlobeProps = {
  partners: Partner[];
  mode: Mode;
  rotation: { lng: number; lat: number };
  hoveredIso: string | null;
  selectedIso: string | null;
  onHover: (iso: string | null) => void;
  onSelect: (iso: string | null) => void;
  palette: Palette;
  arcLift: number;
  arcOpacity: number;
  animSpeed: number;
  showGraticule: boolean;
  showLabels: boolean;
  size?: number;
};

const BRAZIL = { lat: -14.235, lng: -51.9253 };

export default function Globe({
  partners,
  mode,
  rotation,
  hoveredIso,
  selectedIso,
  onHover,
  onSelect,
  palette,
  arcLift,
  arcOpacity,
  animSpeed,
  showGraticule,
  showLabels,
  size = 720,
}: GlobeProps) {
  const R = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;

  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    let rafId: number;
    const start = performance.now();
    const tick = (now: number) => {
      setPulse((((now - start) / (3000 / animSpeed)) % 1));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animSpeed]);

  const grat = useMemo(
    () => graticule(rotation.lng, rotation.lat, R),
    [rotation.lng, rotation.lat, R],
  );
  const landProjected = useMemo(
    () =>
      LAND_POLYGONS.map((poly) =>
        poly.map(([lng, lat]) => project(lat, lng, rotation.lng, rotation.lat, R)),
      ),
    [rotation.lng, rotation.lat, R],
  );

  const brazilP = project(BRAZIL.lat, BRAZIL.lng, rotation.lng, rotation.lat, R);

  // Sort partners ascending by value so big arcs render last (on top)
  const maxValue = Math.max(
    1,
    ...partners.map((p) => Math.max(p.exp_usd, p.imp_usd)),
  );
  const sorted = [...partners].sort((a, b) => {
    const av = mode === "exp" ? a.exp_usd : a.imp_usd;
    const bv = mode === "exp" ? b.exp_usd : b.imp_usd;
    return av - bv;
  });

  const expColor = `oklch(0.72 0.14 ${palette.expHue})`;
  const impColor = `oklch(0.70 0.14 ${palette.impHue})`;
  const activeColor = mode === "exp" ? expColor : impColor;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="globe-svg"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <radialGradient id="globe-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1d2e" stopOpacity="1" />
          <stop offset="85%" stopColor="#0d0f1a" stopOpacity="1" />
          <stop offset="100%" stopColor="#0d0f1a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="globe-glow" cx="50%" cy="50%" r="52%">
          <stop offset="85%" stopColor={activeColor} stopOpacity="0" />
          <stop offset="96%" stopColor={activeColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="globe-sheen" cx="30%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="arc-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id="node-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <g transform={`translate(${cx} ${cy})`}>
        {/* Outer glow */}
        <circle r={R * 1.08} fill="url(#globe-glow)" />
        {/* Globe sphere */}
        <circle r={R} fill="url(#globe-bg)" stroke="rgba(180,190,220,0.18)" strokeWidth="1" />

        {/* Graticule */}
        {showGraticule &&
          grat.map((line, i) => (
            <path
              key={`g-${i}`}
              d={pointsToPath(line, true)}
              fill="none"
              stroke="rgba(180,190,220,0.08)"
              strokeWidth="0.7"
            />
          ))}

        {/* Landmasses */}
        {landProjected.map((poly, i) => {
          const visible = poly.filter((p) => p.visible);
          if (visible.length < 3) return null;
          return (
            <path
              key={`l-${i}`}
              d={pointsToPath(poly, true)}
              fill="rgba(120,132,168,0.18)"
              stroke="rgba(180,190,220,0.25)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Sheen */}
        <circle r={R} fill="url(#globe-sheen)" pointerEvents="none" />

        {/* Arcs */}
        {sorted.map((p) => {
          const value = mode === "exp" ? p.exp_usd : p.imp_usd;
          const norm = value / maxValue;
          const isHover = hoveredIso === p.iso3;
          const isSel = selectedIso === p.iso3;
          const isDim = selectedIso !== null && !isSel;
          const { pts, anyVisible } = arcPath(
            BRAZIL,
            { lat: p.lat, lng: p.lng },
            rotation.lng,
            rotation.lat,
            R,
            arcLift * (0.3 + 0.7 * norm),
            56,
          );
          if (!anyVisible) return null;
          const d = pointsToPath(pts);
          const width = 0.6 + norm * 3.2 + (isHover || isSel ? 1.2 : 0);
          const baseOpacity = arcOpacity * (0.35 + 0.65 * norm);
          const opacity = isDim ? baseOpacity * 0.2 : baseOpacity;
          const pulsePos = Math.floor(pulse * pts.length);
          const pulsePt = pts[pulsePos];

          return (
            <g key={`arc-${p.iso3}`}>
              <path
                d={d}
                fill="none"
                stroke={activeColor}
                strokeWidth={width}
                strokeOpacity={opacity * 0.45}
                strokeLinecap="round"
                filter="url(#arc-blur)"
              />
              <path
                d={d}
                fill="none"
                stroke={activeColor}
                strokeWidth={width * 0.55}
                strokeOpacity={opacity}
                strokeLinecap="round"
              />
              {pulsePt && pulsePt.visible && (
                <circle
                  cx={pulsePt.x}
                  cy={pulsePt.y}
                  r={1.6 + norm * 2.4}
                  fill={activeColor}
                  opacity={opacity * 1.6}
                />
              )}
            </g>
          );
        })}

        {/* Country nodes */}
        {sorted.map((p) => {
          const value = mode === "exp" ? p.exp_usd : p.imp_usd;
          const norm = value / maxValue;
          const proj = project(p.lat, p.lng, rotation.lng, rotation.lat, R);
          if (!proj.visible) return null;
          const isHover = hoveredIso === p.iso3;
          const isSel = selectedIso === p.iso3;
          const isDim = selectedIso !== null && !isSel;
          const r = 1.8 + norm * 4.5 + (isHover || isSel ? 2 : 0);

          return (
            <g
              key={`n-${p.iso3}`}
              onMouseEnter={() => onHover(p.iso3)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(p.iso3 === selectedIso ? null : p.iso3)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={proj.x}
                cy={proj.y}
                r={r * 2.4}
                fill={activeColor}
                opacity={isDim ? 0.05 : 0.18}
                filter="url(#node-glow)"
              />
              <circle cx={proj.x} cy={proj.y} r={r} fill={activeColor} opacity={isDim ? 0.3 : 1} />
              <circle
                cx={proj.x}
                cy={proj.y}
                r={r + 0.8}
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="0.6"
                opacity={isDim ? 0.2 : 0.8}
              />

              {showLabels && (norm > 0.15 || isHover || isSel) && (
                <g transform={`translate(${proj.x + r + 4} ${proj.y + 3})`} pointerEvents="none">
                  <text
                    fontSize={isSel || isHover ? 11 : 9.5}
                    fontWeight={isSel || isHover ? 600 : 500}
                    fill="rgba(235,240,255,0.92)"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
                  >
                    {p.name}
                  </text>
                  <text
                    y={11}
                    fontSize={8.5}
                    fill="rgba(180,190,220,0.7)"
                    fontFamily="var(--font-mono), ui-monospace, monospace"
                  >
                    US$ {(value / 1e9).toFixed(1)}B
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Brazil — always highlighted */}
        {brazilP.visible && (
          <g pointerEvents="none">
            <circle
              cx={brazilP.x}
              cy={brazilP.y}
              r={14}
              fill={activeColor}
              opacity="0.15"
              filter="url(#node-glow)"
            />
            <circle cx={brazilP.x} cy={brazilP.y} r={5} fill="#f5f7ff" />
            <circle cx={brazilP.x} cy={brazilP.y} r={7} fill="none" stroke={activeColor} strokeWidth="1.2" />
            <circle
              cx={brazilP.x}
              cy={brazilP.y}
              r={10 + pulse * 6}
              fill="none"
              stroke={activeColor}
              strokeWidth="0.8"
              opacity={1 - pulse}
            />
          </g>
        )}
      </g>
    </svg>
  );
}
