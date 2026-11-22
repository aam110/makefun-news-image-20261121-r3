// render.ts — tiny vector rasterizer + PNG encoder, Node stdlib only.
// All drawing happens at 2x supersampling, then a box downsample to 1024x1024.
// Text is drawn from real font outlines in glyphs.ts (never hand-drawn letters).
import { FONTS } from "./glyphs.ts";
import type { FontData } from "./glyphs.ts";
import { deflateSync } from "node:zlib";

export const W = 1024;
export const H = 1024;
const SS = 2; // supersample factor
const SW = W * SS;
const SH = H * SS;

export type RGB = [number, number, number];

const FALLBACK_ORDER = ["serif", "serifBold", "sans", "sansBold", "black", "serifItalic"];

function glyphFor(fontName: string, ch: string): { font: FontData; g: { a: number; c: number[][][] } } | null {
  const names = [fontName, ...FALLBACK_ORDER.filter((n) => n !== fontName)];
  for (const n of names) {
    const f = FONTS[n];
    if (f && f.glyphs[ch]) return { font: f, g: f.glyphs[ch] };
  }
  return null;
}

export function textWidth(text: string, fontName: string, size: number): number {
  const f = FONTS[fontName];
  if (!f) return 0;
  let w = 0;
  let prev = "";
  for (const ch of text) {
    const hit = glyphFor(fontName, ch);
    if (!hit) { w += size * 0.5; prev = ""; continue; }
    if (prev) {
      const k = hit.font.kern[prev + ch];
      if (k) w += (k / hit.font.upm) * size;
    }
    w += (hit.g.a / hit.font.upm) * size;
    prev = ch;
  }
  return w;
}

export function wrapText(text: string, fontName: string, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? cur + " " + word : word;
    if (textWidth(trial, fontName, size) <= maxW || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export class Canvas {
  buf: Uint8Array;
  constructor() {
    this.buf = new Uint8Array(SW * SH * 3);
  }
  fill(r: number, g: number, b: number): void {
    for (let i = 0; i < this.buf.length; i += 3) {
      this.buf[i] = r; this.buf[i + 1] = g; this.buf[i + 2] = b;
    }
  }
  // ---- low-level primitives (coordinates in final 1024 space, scaled by SS) ----
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x * SS));
    const y0 = Math.max(0, Math.floor(y * SS));
    const x1 = Math.min(SW, Math.ceil((x + w) * SS));
    const y1 = Math.min(SH, Math.ceil((y + h) * SS));
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * SW + x0) * 3;
      for (let xx = x0; xx < x1; xx++) {
        this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2];
        i += 3;
      }
    }
  }
  // even-odd scanline polygon fill; pts are [x, y] in final space
  poly(pts: number[][], c: RGB): void {
    const p = pts.map(([x, y]) => [x * SS, y * SS]);
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of p) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(SH - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          const t = (yc - a[1]) / (b[1] - a[1]);
          xs.push(a[0] + t * (b[0] - a[0]));
        }
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k]));
        const xb = Math.min(SW - 1, Math.floor(xs[k + 1]));
        for (let x = xa; x <= xb; x++) {
          const i = (y * SW + x) * 3;
          this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2];
        }
      }
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    const R = r * SS;
    const CX = cx * SS, CY = cy * SS;
    const y0 = Math.max(0, Math.floor(CY - R));
    const y1 = Math.min(SH - 1, Math.ceil(CY + R));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - CY;
      const dx = Math.sqrt(Math.max(0, R * R - dy * dy));
      const xa = Math.max(0, Math.ceil(CX - dx));
      const xb = Math.min(SW - 1, Math.floor(CX + dx));
      for (let x = xa; x <= xb; x++) {
        const i = (y * SW + x) * 3;
        this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2];
      }
    }
  }
  // thick line drawn as a quad
  line(x1: number, y1: number, x2: number, y2: number, w: number, c: RGB): void {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
    this.poly([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], c);
  }
  dashedLine(x1: number, y1: number, x2: number, y2: number, w: number, c: RGB, dash = 5, gap = 3): void {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    let d = 0;
    while (d < len) {
      const a = d / len, b = Math.min(1, (d + dash) / len);
      this.line(x1 + dx * a, y1 + dy * a, x1 + dx * b, y1 + dy * b, w, c);
      d += dash + gap;
    }
  }
  // ---- text ----
  drawText(text: string, fontName: string, size: number, x: number, y: number, c: RGB, align: "l" | "c" | "r" = "l"): void {
    let ox = x;
    if (align !== "l") {
      const w = textWidth(text, fontName, size);
      ox = align === "c" ? x - w / 2 : x - w;
    }
    let prev = "";
    for (const ch of text) {
      const hit = glyphFor(fontName, ch);
      if (!hit) { ox += size * 0.5; prev = ""; continue; }
      const { font, g } = hit;
      if (prev) {
        const k = font.kern[prev + ch];
        if (k) ox += (k / font.upm) * size;
      }
      const s = size / font.upm;
      for (const contour of g.c) {
        const pts = contour.map(([px, py]) => [ox + px * s, y - py * s]);
        this.poly(pts, c);
      }
      ox += (g.a / font.upm) * size;
      prev = ch;
    }
  }
  // ---- PNG output ----
  toPNG(): Buffer {
    // box downsample 2x -> 1024x1024
    const raw = Buffer.alloc(H * (1 + W * 3));
    for (let y = 0; y < H; y++) {
      raw[y * (1 + W * 3)] = 0; // filter: none
      for (let x = 0; x < W; x++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < SS; dy++) {
          for (let dx = 0; dx < SS; dx++) {
            const i = ((y * SS + dy) * SW + x * SS + dx) * 3;
            r += this.buf[i]; g += this.buf[i + 1]; b += this.buf[i + 2];
          }
        }
        const o = y * (1 + W * 3) + 1 + x * 3;
        const n = SS * SS;
        raw[o] = Math.round(r / n);
        raw[o + 1] = Math.round(g / n);
        raw[o + 2] = Math.round(b / n);
      }
    }
    const idat = deflateSync(raw, { level: 9 });
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(W, 0);
    ihdr.writeUInt32BE(H, 4);
    ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const parts: Buffer[] = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
    parts.push(chunk("IHDR", ihdr));
    parts.push(chunk("IDAT", idat));
    parts.push(chunk("IEND", Buffer.alloc(0)));
    return Buffer.concat(parts);
  }
}

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}
