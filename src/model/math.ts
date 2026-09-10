import type { Vec3 } from "./types";
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const add = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const sub = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3) => Math.hypot(...a);
export const norm = (a: Vec3): Vec3 => mul(a, 1 / (length(a) || 1));
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const radians = (degrees: number) => (degrees * Math.PI) / 180;
export const angleDiff = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function stream(seed: number, name: string) {
  let h = seed >>> 0;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return rng(h);
}
export function normal(random: () => number) {
  return (
    Math.sqrt(-2 * Math.log(Math.max(1e-10, random()))) *
    Math.cos(2 * Math.PI * random())
  );
}
export function quantile(xs: number[], q: number) {
  const x = [...xs].sort((a, b) => a - b);
  const i = (x.length - 1) * q;
  return lerp(x[Math.floor(i)], x[Math.ceil(i)], i % 1);
}
export function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 1];
  const z = 1.95996398454,
    p = k / n,
    d = 1 + (z * z) / n,
    c = (p + (z * z) / (2 * n)) / d,
    s = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - s), Math.min(1, c + s)];
}
