"use client";

import { useSyncExternalStore } from "react";

// Every sound is synthesized with WebAudio, so there are no files to load or license.

const KEY = "grudge:muted";
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
const listeners = new Set<() => void>();

try {
  muted = typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1";
} catch {}

export function setMuted(v: boolean) {
  muted = v;
  try {
    window.localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}

export function useMuted() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => muted,
    () => false,
  );
}

function ac() {
  if (muted || typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext) {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

type NoiseOpts = { dur: number; type: BiquadFilterType; freq: number; freqTo?: number; q?: number; gain: number; attack?: number; at?: number };

function burst({ dur, type, freq, freqTo, q = 1, gain, attack = 0.005, at = 0 }: NoiseOpts) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

type ToneOpts = { dur: number; type: OscillatorType; freq: number; freqTo?: number; gain: number; at?: number };

function tone({ dur, type, freq, freqTo, gain, at = 0 }: ToneOpts) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  rattle() {
    [0, 0.1, 0.2].forEach((at) => {
      tone({ dur: 0.04, type: "square", freq: 2200, freqTo: 1400, gain: 0.05, at });
      burst({ dur: 0.05, type: "highpass", freq: 4000, gain: 0.08, at });
    });
  },
  spray(dur = 0.6) {
    burst({ dur, type: "bandpass", freq: 6500, freqTo: 5200, q: 0.6, gain: 0.16, attack: 0.03 });
  },
  whoosh() {
    burst({ dur: 0.38, type: "bandpass", freq: 300, freqTo: 2200, q: 1.4, gain: 0.35, attack: 0.12 });
  },
  splat() {
    burst({ dur: 0.28, type: "lowpass", freq: 1400, freqTo: 300, gain: 0.7 });
    tone({ dur: 0.22, type: "sine", freq: 140, freqTo: 45, gain: 0.6 });
    burst({ dur: 0.5, type: "bandpass", freq: 900, freqTo: 400, q: 3, gain: 0.12, at: 0.12 });
  },
  pop() {
    tone({ dur: 0.09, type: "sine", freq: 520, freqTo: 1300, gain: 0.3 });
  },
  boing() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.6);
    lfo.frequency.value = 14;
    lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(g).connect(c.destination);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.7);
    lfo.stop(t + 0.7);
  },
  buzz(dur = 1.2) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const am = c.createOscillator();
    const amg = c.createGain();
    const g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(190, t);
    o.frequency.linearRampToValueAtTime(230, t + dur * 0.5);
    o.frequency.linearRampToValueAtTime(170, t + dur);
    am.frequency.value = 38;
    amg.gain.value = 0.025;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.1);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    am.connect(amg).connect(g.gain);
    o.connect(g).connect(c.destination);
    o.start(t);
    am.start(t);
    o.stop(t + dur + 0.05);
    am.stop(t + dur + 0.05);
  },
  puff(at = 0) {
    burst({ dur: 0.45, type: "lowpass", freq: 700, freqTo: 200, gain: 0.45, attack: 0.04, at });
  },
  rip() {
    for (let i = 0; i < 7; i++) burst({ dur: 0.05, type: "bandpass", freq: 1800 + Math.random() * 2500, q: 2, gain: 0.25, at: i * 0.035 });
  },
  thud(at = 0) {
    tone({ dur: 0.25, type: "sine", freq: 110, freqTo: 40, gain: 0.7, at });
    burst({ dur: 0.12, type: "lowpass", freq: 500, gain: 0.35, at });
  },
  ding() {
    tone({ dur: 0.5, type: "sine", freq: 1760, gain: 0.12 });
    tone({ dur: 0.6, type: "sine", freq: 2637, gain: 0.06, at: 0.04 });
  },
  stamp() {
    tone({ dur: 0.18, type: "sine", freq: 90, freqTo: 35, gain: 0.9 });
    burst({ dur: 0.08, type: "highpass", freq: 2000, gain: 0.3 });
  },
};
