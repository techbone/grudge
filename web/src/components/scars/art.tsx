"use client";

import { useId } from "react";
import {
  between,
  blobPath,
  cloudPath,
  FACE,
  INK,
  PAPER,
  PAYBACK_RED,
  pick,
  rng,
  skinColor,
  SPRAY,
  tornPatchPath,
} from "./geometry";

export type ScarProps = {
  kind: number; // 0 graffiti, 1 hat steal, 2 stink, 3 tomato, 4 googly
  seed: number;
  by: number;
  heavy: boolean;
  skin?: string;
  /** Render scene-only actors (spray can, hand, flying tomato) for the prank animation. */
  scene?: boolean;
  /** Portrait image, needed by the hat-steal scene to lift the real hat off. */
  src?: string;
};

export function ScarArt(p: ScarProps) {
  const art = (() => {
    switch (p.kind) {
      case 0:
        return <Graffiti {...p} />;
      case 1:
        return <HatSteal {...p} />;
      case 2:
        return <Stink {...p} />;
      case 3:
        return <Tomato {...p} />;
      case 4:
        return <Googly {...p} />;
      default:
        return null;
    }
  })();
  return (
    <g data-scar={p.kind}>
      {art}
      {p.heavy && <PaybackStamp seed={p.seed} />}
    </g>
  );
}

// ───────────────────────── graffiti ─────────────────────────

const GRAFFITI = {
  mustache: {
    at: [FACE.mouth[0], FACE.mouth[1] - 40] as const,
    paths: [
      "M0,0 C-25,-38 -100,-48 -135,-12 C-165,20 -205,22 -220,-8 C-228,-26 -212,-40 -196,-30",
      "M0,0 C25,-38 100,-48 135,-12 C165,20 205,22 220,-8 C228,-26 212,-40 196,-30",
    ],
    drips: [[-135, -6], [0, 4], [150, -2]] as const,
  },
  horns: {
    at: [570, 175] as const,
    paths: [
      "M-300,60 C-320,-20 -280,-110 -205,-160 C-228,-90 -215,-30 -180,60",
      "M200,50 C215,-30 260,-110 335,-150 C305,-85 300,-25 320,50",
    ],
    drips: [[-300, 62], [-180, 62], [320, 52]] as const,
  },
  brow: {
    at: [570, 360] as const,
    paths: [
      "M-280,20 Q-140,-50 0,0 Q140,-50 280,20",
      "M-230,8 l-14,-34 M-170,-10 l-8,-38 M-100,-18 l-2,-40 M-30,-6 l4,-38 M40,-14 l8,-38 M110,-20 l12,-36 M180,-6 l16,-32",
    ],
    drips: [[-280, 22], [0, 2], [280, 22]] as const,
  },
  specs: {
    at: [570, 462] as const,
    paths: [
      "M-325,8 a118,112 0 1,0 236,0 a118,112 0 1,0 -236,0",
      "M100,-8 a118,112 0 1,0 236,0 a118,112 0 1,0 -236,0",
      "M-89,0 Q5,-50 100,-8",
      "M-325,8 L-430,-30 M336,-8 L440,-48",
    ],
    drips: [[-207, 120], [218, 104]] as const,
  },
};
const GRAFFITI_KEYS = Object.keys(GRAFFITI) as (keyof typeof GRAFFITI)[];
const TAG_SPOTS = [
  [90, 900, -14],
  [560, 960, -6],
  [60, 680, -18],
] as const;

function Graffiti({ seed, by, heavy, scene }: ScarProps) {
  const r = rng(seed);
  const color = heavy ? PAYBACK_RED : pick(r, SPRAY);
  const v = GRAFFITI[pick(r, GRAFFITI_KEYS)];
  const s = between(r, 0.9, 1.12) * (heavy ? 1.12 : 1);
  const tx = v.at[0] + between(r, -25, 25);
  const ty = v.at[1] + between(r, -20, 20);
  const rot = between(r, -6, 6);
  const w = heavy ? 44 : 34;
  const tag = pick(r, TAG_SPOTS);
  const clip = `tag-${useId()}`;

  return (
    <g>
      <g transform={`translate(${tx},${ty}) rotate(${rot}) scale(${s})`} filter="url(#spray)">
        {v.paths.map((d, i) => (
          <g key={i}>
            <path data-a="stroke" d={d} fill="none" stroke={INK} strokeOpacity={0.55} strokeWidth={(w + 14) / s} strokeLinecap="round" strokeLinejoin="round" />
            <path data-a="stroke" d={d} fill="none" stroke={color} strokeWidth={w / s} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
        {v.drips.map(([x, y], i) => {
          const len = between(r, 40, heavy ? 150 : 110);
          return (
            <g key={i} data-a="drip">
              <path d={`M${x},${y} L${x},${y + len}`} stroke={color} strokeWidth={(w * 0.42) / s} strokeLinecap="round" />
              <circle cx={x} cy={y + len} r={(w * 0.38) / s} fill={color} />
            </g>
          );
        })}
      </g>
      <clipPath id={clip}>
        <rect data-a="tag-wipe" x={-50} y={-160} width={700} height={240} />
      </clipPath>
      <g transform={`translate(${tag[0]},${tag[1]}) rotate(${tag[2]})`} filter="url(#spray)">
        <text
          clipPath={`url(#${clip})`}
          fontSize={heavy ? 170 : 140}
          fill={color}
          stroke={INK}
          strokeWidth={10}
          paintOrder="stroke"
          style={{ fontFamily: "var(--font-permanent-marker), cursive" }}
        >
          #{by}
        </text>
      </g>
      {scene && <SprayCan color={color} />}
    </g>
  );
}

function SprayCan({ color }: { color: string }) {
  return (
    <g data-a="can" opacity={0}>
      <g transform="translate(-72,-18) scale(1.8)">
        <rect x={0} y={20} width={80} height={170} rx={14} fill={color} stroke={INK} strokeWidth={8} />
        <rect x={0} y={70} width={80} height={60} fill={PAPER} stroke={INK} strokeWidth={6} />
        <path d="M10,22 Q40,-8 70,22 Z" fill="#cfcfcf" stroke={INK} strokeWidth={8} />
        <rect x={30} y={-14} width={22} height={18} rx={4} fill={INK} />
        <circle cx={-8} cy={-6} r={10} fill={color} opacity={0.6} data-a="mist" />
      </g>
    </g>
  );
}

// ───────────────────────── hat steal ─────────────────────────

function HatSteal({ seed, by, heavy, skin, scene, src }: ScarProps) {
  const r = rng(seed);
  const uid = useId();
  const patchId = `patch-${uid}`;
  const cut = FACE.brimY + 45 + between(r, -10, 15);
  const patch = tornPatchPath(r, cut);
  const dome = { cx: 590 + between(r, -20, 20), cy: FACE.brimY + 70, rx: 370, ry: 340 };
  const tagRot = between(r, -8, -2);

  return (
    <g>
      <clipPath id={patchId}>
        <path d={patch} />
      </clipPath>
      <g data-a="patch">
        <path d={patch} fill="#fbf8ef" stroke={INK} strokeWidth={6} filter="url(#paper)" />
        <g clipPath={`url(#${patchId})`}>
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={0} x2={1000} y1={70 + i * 52} y2={70 + i * 52} stroke="#8fb3e8" strokeWidth={3} />
          ))}
          <line x1={110} x2={110} y1={0} y2={600} stroke="#e8798a" strokeWidth={4} />
          <ellipse cx={dome.cx} cy={dome.cy} rx={dome.rx} ry={dome.ry} fill={skinColor(skin)} stroke={INK} strokeWidth={20} filter="url(#marker)" />
          <path d={`M${dome.cx - 300},${dome.cy - 120} q-60,-40 -40,-110 M${dome.cx - 250},${dome.cy - 200} q-40,-60 10,-120 M${dome.cx - 170},${dome.cy - 260} q-10,-70 50,-100`} stroke={INK} strokeWidth={12} strokeLinecap="round" fill="none" />
          <path data-a="shine" d={`M${dome.cx - 210},${dome.cy - 190} q70,-90 190,-108`} stroke="#fff" strokeWidth={30} strokeLinecap="round" fill="none" opacity={0.95} />
          <circle data-a="shine" cx={dome.cx + 10} cy={dome.cy - 300} r={14} fill="#fff" />
          <path
            data-a="ghost"
            d="M250,170 Q600,-130 950,170 L1010,215 L190,215 Z"
            fill="none"
            stroke={INK}
            strokeWidth={7}
            strokeDasharray="22 18"
            opacity={0.55}
            transform={`translate(${between(r, -30, 30)},-110)`}
          />
        </g>
      </g>
      <g data-a="tape">
        <rect x={40} y={cut - 50} width={200} height={62} fill="#f2e3a0" stroke="#b9a35a" strokeWidth={3} opacity={0.92} transform={`rotate(-24 140 ${cut - 19})`} />
        <rect x={780} y={cut - 90} width={200} height={62} fill="#f2e3a0" stroke="#b9a35a" strokeWidth={3} opacity={0.92} transform={`rotate(18 880 ${cut - 59})`} />
      </g>
      <g data-a="stolen" transform={`translate(${290 + between(r, -20, 20)},120) rotate(${tagRot})`}>
        <text fontSize={heavy ? 104 : 88} fill={heavy ? PAYBACK_RED : INK} style={{ fontFamily: "var(--font-permanent-marker), cursive" }}>
          STOLEN
        </text>
        <text y={70} x={8} fontSize={52} fill={INK} style={{ fontFamily: "var(--font-permanent-marker), cursive" }}>
          by #{by}
        </text>
      </g>
      {scene && src && (
        <g data-a="hatpiece" clipPath={`url(#${patchId})`}>
          <image href={src} width={1000} height={1000} />
        </g>
      )}
      {scene && <Glove />}
    </g>
  );
}

function Glove() {
  return (
    <g data-a="hand" opacity={0}>
      <g transform="scale(1.45)">
      <rect x={-70} y={-200} width={140} height={110} rx={20} fill={PAPER} stroke={INK} strokeWidth={10} />
      <ellipse cx={0} cy={-40} rx={110} ry={95} fill="#fff" stroke={INK} strokeWidth={10} />
      <g data-a="fingers">
        {[-75, -25, 25, 75].map((x) => (
          <rect key={x} x={x - 22} y={0} width={44} height={110} rx={22} fill="#fff" stroke={INK} strokeWidth={10} />
        ))}
      </g>
      <path d="M-60,-70 q60,22 120,0" stroke={INK} strokeWidth={6} fill="none" />
      </g>
    </g>
  );
}

// ───────────────────────── stink ─────────────────────────

function Stink({ seed, heavy }: ScarProps) {
  const r = rng(seed);
  const k = heavy ? 1.25 : 1;
  const clouds = [
    { cx: 250 + between(r, -40, 40), cy: 850, rx: 240 * k, ry: 125 * k },
    { cx: 840 + between(r, -40, 30), cy: 600 + between(r, -40, 40), rx: 130 * k, ry: 78 * k },
    { cx: 120, cy: 560 + between(r, -40, 40), rx: 90 * k, ry: 58 * k },
  ];
  const flies = Array.from({ length: heavy ? 5 : 3 }, (_, i) => {
    const a = (i / (heavy ? 5 : 3)) * Math.PI * 2 + between(r, 0, 1);
    return { x: 600 + Math.cos(a) * 330, y: 470 + Math.sin(a) * 260, rot: between(r, -40, 40) };
  });
  const lines = [430, 590, 750].map((x) => x + between(r, -30, 30));

  return (
    <g>
      <rect data-a="haze" width={1000} height={1000} fill="#8fcf3c" opacity={heavy ? 0.16 : 0.1} style={{ mixBlendMode: "multiply" }} />
      {lines.map((x, i) => (
        <path
          key={i}
          data-a="wave"
          d={`M${x},330 c-40,-40 40,-70 0,-110 c-40,-40 40,-70 0,-110`}
          fill="none"
          stroke="#4f8a12"
          strokeWidth={20}
          strokeLinecap="round"
          filter="url(#marker)"
        />
      ))}
      {clouds.map((c, i) => (
        <g key={i} data-a="cloud">
          <path d={cloudPath(r, c.cx, c.cy, c.rx, c.ry, 7)} fill="#cde872" fillOpacity={0.78} stroke="#4c6b12" strokeWidth={8} filter="url(#marker)" />
          <path
            d={`M${c.cx - c.rx * 0.45},${c.cy + c.ry * 0.1} c${c.rx * 0.1},${-c.ry * 0.5} ${c.rx * 0.5},${-c.ry * 0.5} ${c.rx * 0.45},${-c.ry * 0.05} c${-c.rx * 0.05},${c.ry * 0.3} ${-c.rx * 0.3},${c.ry * 0.3} ${-c.rx * 0.25},${c.ry * 0.05}`}
            fill="none"
            stroke="#6e9420"
            strokeWidth={7}
            strokeLinecap="round"
          />
        </g>
      ))}
      {flies.map((f, i) => (
        <g key={i} data-a="fly" data-idle="fly" transform={`translate(${f.x},${f.y}) rotate(${f.rot})`}>
          <g>
            <ellipse cx={-16} cy={-22} rx={22} ry={13} fill="#fff" stroke={INK} strokeWidth={5} opacity={0.9} data-a="wing" />
            <ellipse cx={16} cy={-22} rx={22} ry={13} fill="#fff" stroke={INK} strokeWidth={5} opacity={0.9} data-a="wing" />
            <ellipse cx={0} cy={0} rx={21} ry={16} fill={INK} />
            <circle cx={12} cy={-4} r={5} fill="#c0392b" />
          </g>
        </g>
      ))}
    </g>
  );
}

// ───────────────────────── tomato ─────────────────────────

const TOMATO_SPOTS = [FACE.eyeL, FACE.eyeR, FACE.forehead, FACE.cheekR, FACE.mouth];

function Tomato({ seed, heavy, scene }: ScarProps) {
  const r = rng(seed);
  const spot = pick(r, TOMATO_SPOTS);
  const cx = spot[0] + between(r, -40, 40);
  const cy = spot[1] + between(r, -30, 30);
  const R = heavy ? 185 : 140;
  const drops = Array.from({ length: heavy ? 14 : 10 }, () => {
    const a = between(r, 0, Math.PI * 2);
    const d = R * between(r, 1.25, 2.3);
    return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: between(r, 7, 22) };
  });
  const drips = Array.from({ length: 3 }, () => ({ x: cx + between(r, -R * 0.6, R * 0.6), len: between(r, 90, heavy ? 280 : 210), w: between(r, 18, 30) }));
  const seeds = Array.from({ length: 6 }, () => ({ x: cx + between(r, -R * 0.55, R * 0.55), y: cy + between(r, -R * 0.45, R * 0.45), rot: between(r, 0, 180) }));

  return (
    <g>
      <g data-a="splat" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {drips.map((d, i) => (
          <path
            key={i}
            data-a="tdrip"
            d={`M${d.x - d.w / 2},${cy} L${d.x - d.w / 2},${cy + R * 0.6 + d.len} a${d.w / 2},${d.w / 2} 0 0,0 ${d.w},0 L${d.x + d.w / 2},${cy} Z`}
            fill="#d42a17"
            stroke={INK}
            strokeWidth={5}
          />
        ))}
        <path d={blobPath(r, cx, cy, R, 14, 0.45)} fill="#d42a17" stroke={INK} strokeWidth={9} filter="url(#marker)" />
        <path d={blobPath(r, cx - R * 0.18, cy - R * 0.2, R * 0.45, 9, 0.4)} fill="#ff6a4d" opacity={0.85} />
        {seeds.map((s, i) => (
          <ellipse key={i} cx={s.x} cy={s.y} rx={9} ry={5} fill="#f9d65c" transform={`rotate(${s.rot} ${s.x} ${s.y})`} />
        ))}
      </g>
      {drops.map((d, i) => (
        <circle key={i} data-a="drop" data-cx={cx} data-cy={cy} cx={d.x} cy={d.y} r={d.r} fill="#d42a17" stroke={INK} strokeWidth={4} />
      ))}
      {scene && (
        <g data-a="tomato" opacity={0} data-tx={cx} data-ty={cy}>
          <circle r={70} fill="#e2321d" stroke={INK} strokeWidth={9} />
          <path d="M-30,-25 a35,30 0 0,1 30,-25" stroke="#fff" strokeWidth={10} strokeLinecap="round" fill="none" opacity={0.7} />
          <path d="M0,-66 l-28,-18 l20,2 l8,-22 l8,22 l20,-2 Z" fill="#3d9a2e" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
}

// ───────────────────────── googly eyes ─────────────────────────

function Googly({ seed, heavy }: ScarProps) {
  const r = rng(seed);
  const base = heavy ? 128 : 100;
  const eyes = [FACE.eyeL, FACE.eyeR].map(([x, y]) => ({
    x: x + between(r, -18, 18),
    y: y + between(r, -14, 14),
    R: base * between(r, 0.85, 1.12),
    px: between(r, -0.35, 0.35),
    py: between(r, 0.2, 0.45),
  }));
  return (
    <g>
      {eyes.map((e, i) => (
        <g key={i} data-a="eye" transform={`translate(${e.x},${e.y})`}>
          <circle r={e.R} fill="#fff" stroke={INK} strokeWidth={12} filter="url(#marker)" />
          <circle r={e.R * 0.82} fill="none" stroke="#000" strokeOpacity={0.06} strokeWidth={e.R * 0.25} />
          <g data-a="pupil" data-r={e.R * 0.5} transform={`translate(${e.px * e.R},${e.py * e.R})`}>
            <circle r={e.R * 0.46} fill={INK} />
            <circle cx={-e.R * 0.14} cy={-e.R * 0.16} r={e.R * 0.12} fill="#fff" />
          </g>
          {heavy && <path d={`M${-e.R * 0.9},${-e.R * 1.15} l${e.R * 1.6},${e.R * 0.45}`} stroke={INK} strokeWidth={22} strokeLinecap="round" />}
        </g>
      ))}
    </g>
  );
}

// ───────────────────────── payback stamp ─────────────────────────

function PaybackStamp({ seed }: { seed: number }) {
  const r = rng(seed ^ 0x9e3779b9);
  const x = between(r, 560, 640);
  const y = between(r, 800, 860);
  const rot = between(r, -18, -8);
  return (
    <g data-a="stamp" transform={`translate(${x},${y}) rotate(${rot})`} filter="url(#stamp)">
      <rect x={-235} y={-82} width={470} height={150} rx={14} fill="none" stroke={PAYBACK_RED} strokeWidth={14} />
      <rect x={-215} y={-64} width={430} height={114} rx={8} fill="none" stroke={PAYBACK_RED} strokeWidth={4} />
      <text x={0} y={30} textAnchor="middle" fontSize={96} fontWeight={900} fill={PAYBACK_RED} style={{ fontFamily: "var(--font-bricolage), sans-serif", letterSpacing: "0.04em" }}>
        PAYBACK
      </text>
    </g>
  );
}

/** Filters shared by every portrait. Render once per page. */
export function ScarDefs() {
  return (
    <svg width={0} height={0} aria-hidden style={{ position: "absolute" }}>
      <ScarFilterDefs />
    </svg>
  );
}

/** The filter <defs> on their own, for standalone SVGs such as Wall textures. */
export function ScarFilterDefs() {
  return (
    <defs>
        <filter id="spray" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={3} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={7} result="rough" />
          <feGaussianBlur in="rough" stdDeviation={6} result="mist" />
          <feComponentTransfer in="mist" result="mistSoft">
            <feFuncA type="linear" slope={0.45} />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="mistSoft" />
            <feMergeNode in="rough" />
          </feMerge>
        </filter>
        <filter id="marker" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={6} />
        </filter>
        <filter id="paper" x="-5%" y="-5%" width="110%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={1} seed={2} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={8} result="edge" />
          <feDropShadow in="edge" dx={0} dy={10} stdDeviation={8} floodColor="#000" floodOpacity={0.35} />
        </filter>
        <filter id="stamp" x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={11} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.9" result="holes" />
          <feComposite in="SourceGraphic" in2="holes" operator="in" />
        </filter>
    </defs>
  );
}
