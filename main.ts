// main.ts — news-image-20261121 round 3: "The world in one day".
// Node 22 stdlib only. Draws one 1024x1024 PNG to $MAKEFUN_OUTPUT_DIR/entry.png.
// Text uses real font outlines (glyphs.ts, built from OFL system fonts).
import { Canvas, textWidth, wrapText } from "./render.ts";
import type { RGB } from "./render.ts";
import { mkdirSync, writeFileSync } from "node:fs";

// ---------- palette ----------
const PAPER: RGB = [246, 241, 229];
const INK: RGB = [20, 20, 20];
const NAVY: RGB = [22, 35, 63];
const RED: RGB = [168, 30, 34];
const BRIGHT_RED: RGB = [200, 40, 40];
const BLUE: RGB = [31, 78, 121];
const GREEN: RGB = [30, 107, 58];
const ORANGE: RGB = [210, 105, 30];
const TEAL: RGB = [14, 122, 107];
const PURPLE: RGB = [107, 63, 160];
const PINK: RGB = [176, 58, 107];
const GOLD: RGB = [150, 110, 20];
const DARK: RGB = [51, 51, 51];
const SEA: RGB = [207, 224, 232];
const SAND: RGB = [233, 220, 189];
const GRAY: RGB = [110, 110, 105];
const LIGHT: RGB = [251, 248, 240];
const SKY_NIGHT: RGB = [28, 36, 64];
const SEA_NIGHT: RGB = [26, 58, 92];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const YELLOW: RGB = [245, 197, 66];
const FLAME: RGB = [232, 114, 42];
const SMOKE: RGB = [105, 105, 105];

const REGION_COLORS: Record<string, RGB> = {
  Europe: BLUE, "Middle East": RED, Americas: GREEN, Africa: ORANGE,
  "South Asia": PINK, "East Asia": PURPLE, "South-East Asia": TEAL,
  Oceania: GOLD, Global: DARK,
};
const REGION_COUNTS: [string, number][] = [
  ["Europe", 8], ["Middle East", 6], ["Americas", 8], ["Africa", 3],
  ["South Asia", 2], ["East Asia", 2], ["South-East Asia", 2], ["Oceania", 2], ["Global", 2],
];

// ---------- scene helpers ----------
function flame(c: Canvas, x: number, y: number, s: number): void {
  // flame rooted at (x, y), height s
  c.poly([[x - 0.5 * s, y], [x - 0.48 * s, y - 0.45 * s], [x - 0.22 * s, y - 0.62 * s],
    [x - 0.05 * s, y - 0.95 * s], [x + 0.12 * s, y - 1.0 * s], [x + 0.3 * s, y - 0.72 * s],
    [x + 0.48 * s, y - 0.4 * s], [x + 0.5 * s, y]], FLAME);
  c.poly([[x - 0.28 * s, y], [x - 0.25 * s, y - 0.35 * s], [x - 0.08 * s, y - 0.55 * s],
    [x + 0.08 * s, y - 0.62 * s], [x + 0.26 * s, y - 0.3 * s], [x + 0.28 * s, y]], YELLOW);
}
function smokePlume(c: Canvas, x: number, y: number, s: number): void {
  const puffs: [number, number, number, RGB][] = [
    [0, 0, 0.34, [90, 90, 90]], [0.3, -0.55, 0.42, [110, 110, 110]],
    [-0.25, -1.05, 0.5, [125, 125, 125]], [0.35, -1.55, 0.44, [140, 140, 140]],
    [-0.1, -2.0, 0.36, [155, 155, 155]],
  ];
  for (const [dx, dy, r, col] of puffs) c.circle(x + dx * s, y + dy * s, r * s, col);
}
function waves(c: Canvas, x: number, y: number, w: number, color: RGB, amp = 2.5): void {
  for (let row = 0; row < 3; row++) {
    const yy = y + row * 9;
    let prevX = x, prevY = yy;
    for (let px = x + 6; px <= x + w; px += 6) {
      const py = yy + Math.sin((px - x) / 9 + row * 1.7) * amp;
      c.line(prevX, prevY, px, py, 1.2, color);
      prevX = px; prevY = py;
    }
  }
}
function drone(c: Canvas, x: number, y: number, s: number): void {
  c.rect(x - 0.5 * s, y - 0.18 * s, s, 0.36 * s, INK);
  c.line(x - 0.7 * s, y - 0.3 * s, x + 0.7 * s, y - 0.3 * s, 0.8, INK);
  c.line(x - 0.7 * s, y + 0.3 * s, x + 0.7 * s, y + 0.3 * s, 0.8, INK);
  c.circle(x - 0.85 * s, y - 0.3 * s, 0.28 * s, GRAY);
  c.circle(x + 0.85 * s, y - 0.3 * s, 0.28 * s, GRAY);
  c.circle(x - 0.85 * s, y + 0.3 * s, 0.28 * s, GRAY);
  c.circle(x + 0.85 * s, y + 0.3 * s, 0.28 * s, GRAY);
  c.circle(x, y, 0.14 * s, BRIGHT_RED);
}
function arc(c: Canvas, x1: number, y1: number, x2: number, y2: number, lift: number, col: RGB, w = 1.4): void {
  // dashed quadratic arc from (x1,y1) to (x2,y2), peaking `lift` px above the chord
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - lift;
  let px = x1, py = y1;
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    const qx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
    const qy = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
    if (i % 2 === 1) c.line(px, py, qx, qy, w, col);
    px = qx; py = qy;
  }
  // arrowhead at the end
  const ang = Math.atan2(y2 - py, x2 - px);
  const ah = 6;
  c.poly([[x2, y2], [x2 - ah * Math.cos(ang - 0.45), y2 - ah * Math.sin(ang - 0.45)],
    [x2 - ah * Math.cos(ang + 0.45), y2 - ah * Math.sin(ang + 0.45)]], col);
}
function mountains(c: Canvas, x: number, y: number, w: number, h: number, col: RGB, snow = true): void {
  const peaks: [number, number, number][] = [[0.12, 0.55, 0.62], [0.38, 1.0, 0.78], [0.66, 0.7, 0.62], [0.88, 0.5, 0.5]];
  for (const [fx, fh, fw] of peaks) {
    const px = x + fx * w, py = y + h - fh * h, half = (fw * w) / 2;
    c.poly([[px - half, y + h], [px, py], [px + half, y + h]], col);
    if (snow) {
      c.poly([[px - half * 0.34, py + fh * h * 0.3], [px, py], [px + half * 0.34, py + fh * h * 0.3]], WHITE);
    }
  }
}
function city(c: Canvas, x: number, y: number, w: number, h: number, col: RGB, lit: RGB): void {
  const heights = [0.55, 0.85, 0.4, 0.95, 0.6, 0.75, 0.45, 0.9, 0.5, 0.7];
  const bw = w / heights.length;
  for (let i = 0; i < heights.length; i++) {
    const bx = x + i * bw, bh = heights[i] * h;
    c.rect(bx + 1, y + h - bh, bw - 2, bh, col);
    // lit windows: deterministic pattern
    for (let wy = 0; wy < 3; wy++) {
      for (let wx = 0; wx < 2; wx++) {
        if ((i * 7 + wy * 3 + wx * 5) % 4 !== 0) continue;
        c.rect(bx + 2 + wx * (bw / 2.4), y + h - bh + 4 + wy * (bh / 3.4), 2.2, 2.6, lit);
      }
    }
  }
}
function chartLine(c: Canvas, pts: number[][], col: RGB, w = 2): void {
  for (let i = 0; i + 1 < pts.length; i++) c.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, col);
  // arrowhead at the last segment
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  c.poly([[b[0], b[1]], [b[0] - 7 * Math.cos(ang - 0.45), b[1] - 7 * Math.sin(ang - 0.45)],
    [b[0] - 7 * Math.cos(ang + 0.45), b[1] - 7 * Math.sin(ang + 0.45)]], col);
}
function clockFace(c: Canvas, cx: number, cy: number, r: number, hour: number, min: number): void {
  c.circle(cx, cy, r, WHITE);
  c.circle(cx, cy, r, INK); // rim via outer ring trick: redraw smaller white
  c.circle(cx, cy, r - 1.6, WHITE);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const big = i % 3 === 0;
    c.line(cx + Math.sin(a) * (r - (big ? 5 : 3)), cy - Math.cos(a) * (r - (big ? 5 : 3)),
      cx + Math.sin(a) * (r - 1.5), cy - Math.cos(a) * (r - 1.5), big ? 1.6 : 1, INK);
  }
  const ha = (((hour % 12) + min / 60) / 12) * Math.PI * 2;
  const ma = (min / 60) * Math.PI * 2;
  c.line(cx, cy, cx + Math.sin(ha) * r * 0.52, cy - Math.cos(ha) * r * 0.52, 2.4, INK);
  c.line(cx, cy, cx + Math.sin(ma) * r * 0.8, cy - Math.cos(ma) * r * 0.8, 1.6, RED);
  c.circle(cx, cy, 2, RED);
}
function badge(c: Canvas, x: number, y: number, text: string, bg: RGB, fg: RGB, font = "sansBold", size = 9): number {
  const w = textWidth(text, font, size) + 10;
  c.rect(x, y, w, size + 6, bg);
  c.drawText(text, font, size, x + 5, y + size + 1.5, fg);
  return w;
}
function numPin(c: Canvas, cx: number, cy: number, n: number, col: RGB, r = 6.5): void {
  c.circle(cx, cy, r, WHITE);
  c.circle(cx, cy, r - 1.2, col);
  const s = String(n);
  c.drawText(s, "sansBold", r * 1.05, cx - textWidth(s, "sansBold", r * 1.05) / 2, cy + r * 0.55, WHITE);
}

// ---------- hero illustrations ----------
function heroGulf(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, SEA);
  // landmasses (simplified Gulf coastline)
  c.poly([[x + 150, y], [x + w, y], [x + w, y + 74], [x + 302, y + 68], [x + 282, y + 58],
    [x + 256, y + 52], [x + 230, y + 44], [x + 205, y + 34], [x + 182, y + 20], [x + 162, y + 8]], SAND); // Iran
  c.poly([[x, y + 96], [x, y + h], [x + 148, y + h], [x + 140, y + 122], [x + 118, y + 106],
    [x + 88, y + 100], [x + 58, y + 96], [x + 28, y + 93]], SAND); // Saudi Arabia
  c.poly([[x + 96, y + 96], [x + 104, y + 78], [x + 112, y + 92], [x + 108, y + 98]], SAND); // Qatar
  c.poly([[x + 152, y + h], [x + 202, y + h], [x + 196, y + 118], [x + 180, y + 112], [x + 166, y + 120]], SAND); // U.A.E.
  c.poly([[x + 282, y + h], [x + w, y + h], [x + w, y + 96], [x + 306, y + 106], [x + 292, y + 120]], SAND); // Oman
  // Bahrain island
  c.circle(x + 141, y + 96, 5.5, SAND);
  c.circle(x + 141, y + 96, 5.5, RED); c.circle(x + 141, y + 96, 4.2, SAND);
  // missile arcs from Iran
  arc(c, x + 232, y + 30, x + 146, y + 92, 14, BRIGHT_RED);
  arc(c, x + 252, y + 38, x + 216, y + 84, 10, BRIGHT_RED);
  // tankers in the Gulf
  for (const [tx, ty] of [[206, 86], [238, 96]] as [number, number][]) {
    c.poly([[x + tx, y + ty], [x + tx + 22, y + ty], [x + tx + 18, y + ty + 5], [x + tx + 3, y + ty + 5]], [30, 30, 30]);
    c.rect(x + tx + 15, y + ty - 5, 5, 5, [120, 40, 40]);
  }
  // fire at the Bahrain industrial site + smoke
  flame(c, x + 141, y + 94, 15);
  smokePlume(c, x + 146, y + 84, 7);
  // small fire on the second tanker
  flame(c, x + 249, y + 94, 8);
  // labels
  c.drawText("IRAN", "sansBold", 9, x + 252, y + 26, NAVY);
  c.drawText("SAUDI ARABIA", "sansBold", 8, x + 22, y + 122, NAVY);
  c.drawText("QATAR", "sansBold", 7, x + 88, y + 76, NAVY);
  c.drawText("THE GULF", "serifItalic", 9.5, x + 176, y + 74, BLUE);
  c.drawText("U.A.E.", "sansBold", 7, x + 168, y + 134, NAVY);
  c.drawText("OMAN", "sansBold", 8, x + 288, y + 120, NAVY);
  c.drawText("STRAIT OF HORMUZ", "sansBold", 6.5, x + 236, y + 70, NAVY);
  c.drawText("MANAMA", "sans", 6.5, x + 128, y + 110, INK);
  c.drawText("KHASAB", "sans", 6.5, x + 288, y + 88, INK);
  badge(c, x + 6, y + 6, "2 BASES HIT", RED, WHITE, "sansBold", 9);
  c.rect(x + 4, y + h - 15, textWidth("2 tankers attacked (UKMTO)", "sansBold", 7.5) + 8, 12, [0, 0, 0]);
  c.drawText("2 tankers attacked (UKMTO)", "sansBold", 7.5, x + 8, y + h - 5, WHITE);
}
function heroSparta(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, SKY_NIGHT);
  c.rect(x, y + 82, w, h - 82, SEA_NIGHT);
  // stars
  for (const [sx, sy] of [[20, 12], [60, 22], [120, 10], [180, 18], [300, 14], [230, 8], [150, 26]] as [number, number][])
    c.circle(x + sx, y + sy, 1, WHITE);
  // drones with dashed flight paths
  c.dashedLine(x + 318, y + 30, x + 236, y + 28, 1.2, BRIGHT_RED);
  drone(c, x + 228, y + 28, 9);
  c.dashedLine(x + 318, y + 48, x + 96, y + 40, 1.2, BRIGHT_RED);
  drone(c, x + 88, y + 40, 9);
  // ship: hull + containers + bridge
  const hx = x + 38, hy = y + 78, hw = 252;
  c.poly([[hx, hy], [hx + hw, hy], [hx + hw - 14, hy + 26], [hx + 8, hy + 26]], [12, 12, 14]);
  c.rect(hx + 6, hy + 22, hw - 20, 3, [178, 34, 34]); // red waterline
  const contCols: RGB[] = [[178, 90, 40], [40, 90, 140], [60, 120, 70], [150, 150, 150], [178, 90, 40]];
  for (let i = 0; i < 5; i++) {
    const cx0 = hx + 14 + i * 34;
    c.rect(cx0, hy - 16, 30, 16, contCols[i]);
    c.line(cx0, hy - 16, cx0, hy, 1, [0, 0, 0]);
  }
  // tilted container near the fire
  c.poly([[hx + 150, hy - 14], [hx + 178, hy - 20], [hx + 182, hy - 6], [hx + 154, hy]], [178, 90, 40]);
  // bridge tower
  c.rect(hx + hw - 46, hy - 34, 34, 34, [240, 240, 235]);
  for (let wy = 0; wy < 3; wy++) c.rect(hx + hw - 42, hy - 30 + wy * 10, 26, 5, [30, 60, 90]);
  c.rect(hx + hw - 40, hy - 44, 22, 10, [60, 60, 60]);
  // big fire midship + smoke
  flame(c, hx + 132, hy, 34);
  flame(c, hx + 158, hy, 22);
  smokePlume(c, hx + 150, hy - 30, 13);
  // waves
  waves(c, x + 6, y + 112, w - 12, [200, 220, 235]);
  // ship name on hull
  c.drawText("SPARTA II", "sansBold", 8, hx + 16, hy + 18, WHITE);
  // badges
  badge(c, x + 6, y + 6, "06:50 UTC", BLACK, WHITE, "sansBold", 9);
  badge(c, x + 6, y + 22, "2 DRONES", RED, WHITE, "sansBold", 9);
  // Finland inset map
  const ix = x + w - 68, iy = y + 6;
  c.rect(ix, iy, 62, 50, WHITE);
  c.rect(ix, iy, 62, 1, INK); c.rect(ix, iy + 49, 62, 1, INK);
  c.rect(ix, iy, 1, 50, INK); c.rect(ix + 61, iy, 1, 50, INK);
  c.poly([[ix + 12, iy + 12], [ix + 20, iy + 8], [ix + 28, iy + 11], [ix + 31, iy + 18], [ix + 28, iy + 26],
    [ix + 22, iy + 32], [ix + 14, iy + 30], [ix + 10, iy + 22], [ix + 11, iy + 15]], [210, 220, 225]);
  c.circle(ix + 26, iy + 40, 3, BRIGHT_RED);
  c.drawText("FINLAND", "sansBold", 6, ix + 30, iy + 12, INK);
  c.drawText("ESTONIA", "sans", 5.5, ix + 30, iy + 30, GRAY);
  c.drawText("RUSSIA", "sans", 5.5, ix + 40, iy + 22, GRAY);
}
function heroCOP(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, LIGHT);
  // --- left panel: draft document ---
  const dx = x + 6, dy = y + 8, dw = 100, dh = h - 16;
  c.rect(dx, dy, dw, dh, WHITE);
  c.rect(dx, dy, dw, 1, INK); c.rect(dx, dy + dh - 1, dw, 1, INK);
  c.rect(dx, dy, 1, dh, INK); c.rect(dx + dw - 1, dy, 1, dh, INK);
  c.circle(dx + 12, dy + 12, 8, GREEN);
  c.drawText("31", "sansBold", 8, dx + 8, dy + 15, WHITE);
  c.drawText("COP31", "sansBold", 8, dx + 24, dy + 12, GREEN);
  c.drawText("DRAFT TEXT", "sansBold", 9, dx + 8, dy + 30, INK);
  c.line(dx + 8, dy + 34, dx + dw - 8, dy + 34, 1, INK);
  for (let i = 0; i < 4; i++) c.rect(dx + 8, dy + 42 + i * 8, dw - 16 - (i === 3 ? 22 : 0), 3, [170, 170, 165]);
  c.drawText("fossil fuels", "serifBold", 11, dx + 8, dy + 82, RED);
  c.line(dx + 7, dy + 79, dx + 8 + textWidth("fossil fuels", "serifBold", 11), dy + 79, 1.6, RED);
  c.rect(dx + 8, dy + 90, dw - 16, 3, [170, 170, 165]);
  c.rect(dx + 8, dy + 98, dw - 30, 3, [170, 170, 165]);
  c.drawText("no mention", "serifItalic", 8.5, dx + 8, dy + 114, RED);
  c.drawText("in the draft", "serifItalic", 8.5, dx + 8, dy + 124, RED);
  // --- middle panel: calendar grid 9-21 + +1 DAY ---
  const mx = x + 114, my = y + 8;
  c.drawText("NOVEMBER", "sansBold", 8, mx + 2, my + 8, INK);
  c.drawText("ANTALYA", "sans", 8, mx + 62, my + 8, GRAY);
  const cw = 14, ch = 13;
  for (let d = 0; d < 14; d++) {
    const day = 9 + d;
    const gx = mx + (d % 7) * cw, gy = my + 14 + Math.floor(d / 7) * ch;
    if (day === 21) {
      c.rect(gx, gy, cw - 1.5, ch - 1.5, RED);
      c.drawText("21", "sansBold", 8, gx + 2.5, gy + 10, WHITE);
    } else if (day <= 21) {
      c.rect(gx, gy, cw - 1.5, ch - 1.5, [235, 230, 218]);
      c.drawText(String(day), "sans", 7.5, gx + 2.5, gy + 10, INK);
    } else {
      c.rect(gx, gy, cw - 1.5, ch - 1.5, [245, 242, 233]);
      c.drawText("22", "sans", 7.5, gx + 2.5, gy + 10, GRAY);
    }
  }
  badge(c, mx + 2, my + 48, "+1 DAY", RED, WHITE, "sansBold", 9);
  c.drawText("Day 13 of a 12-day summit", "serifItalic", 8.5, mx + 2, my + 72, INK);
  c.drawText("130+ countries want", "serif", 8.5, mx + 2, my + 84, INK);
  c.drawText("fossil fuels named", "serif", 8.5, mx + 2, my + 94, INK);
  c.drawText("a day past Friday's deadline", "serifItalic", 8.5, mx + 2, my + 112, GRAY);
  // --- right panel: overtime clock + thermometer ---
  const rx = x + 224;
  clockFace(c, rx + 34, y + 40, 26, 11, 55);
  c.drawText("OVERTIME", "sansBold", 10, rx + 34 - textWidth("OVERTIME", "sansBold", 10) / 2, y + 82, RED);
  // thermometer
  const tx = rx + 72, ty = y + 16;
  c.rect(tx, ty, 7, 44, WHITE);
  c.rect(tx, ty, 7, 44, INK);
  c.circle(tx + 3.5, ty + 50, 7, WHITE);
  c.circle(tx + 3.5, ty + 50, 7, INK);
  c.rect(tx + 1.5, ty + 14, 4, 32, RED);
  c.circle(tx + 3.5, ty + 50, 4.5, RED);
  c.drawText("1.5°C", "sansBold", 8, tx - 4, ty + 66, RED);
  c.drawText("limit", "sans", 7.5, tx - 2, ty + 76, INK);
  c.drawText("talks paused", "serifItalic", 8.5, rx + 2, y + 100, INK);
  c.drawText("for the night", "serifItalic", 8.5, rx + 2, y + 110, INK);
}

// ---------- medium illustrations (193 x 50) ----------
function medKryvyi(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, SKY_NIGHT);
  city(c, x, y + 8, w, h - 8, [8, 8, 12], YELLOW);
  flame(c, x + w * 0.62, y + h - 8, 14);
  smokePlume(c, x + w * 0.64, y + h - 22, 6);
  arc(c, x + w * 0.8, y + 4, x + w * 0.62, y + h - 12, 8, BRIGHT_RED, 1.2);
  badge(c, x + 4, y + h - 15, "2 KILLED", RED, WHITE, "sansBold", 10);
}
function medSinaloa(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, [58, 44, 66]);
  mountains(c, x, y + 18, w, h - 18, [30, 24, 34], false);
  // helicopter silhouette + searchlight
  const hx = x + w * 0.6, hy = y + 14;
  c.rect(hx - 12, hy - 3, 24, 7, BLACK);
  c.rect(hx + 10, hy - 1, 10, 3, BLACK);
  c.line(hx - 14, hy - 8, hx + 14, hy - 8, 1.4, BLACK);
  c.circle(hx - 16, hy - 8, 2.5, BLACK); c.circle(hx + 16, hy - 8, 2.5, BLACK);
  c.poly([[hx - 4, hy + 4], [hx + 4, hy + 4], [hx + 16, y + h], [hx - 16, y + h]], [245, 220, 120]);
  badge(c, x + 4, y + h - 15, "11 KILLED", RED, WHITE, "sansBold", 10);
}
function medPeru(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, [216, 226, 234]);
  mountains(c, x, y + 6, w, h - 6, [122, 92, 62]);
  // seismograph zigzag
  const pts: number[][] = [];
  const spikes = [0, -6, 8, -14, 12, -8, 4, -2, 6, -10, 3, -1, 0];
  for (let i = 0; i < spikes.length; i++) pts.push([x + 4 + (i / (spikes.length - 1)) * (w - 8), y + 16 + spikes[i]]);
  chartLine(c, pts, RED, 1.6);
  c.rect(x + 4, y + h - 20, textWidth("M6.7", "serifBold", 17) + 8, 18, [90, 20, 20]);
  c.drawText("M6.7", "serifBold", 17, x + 8, y + h - 6, WHITE);
}
function medEU(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, [232, 238, 247]);
  // EU flag circle of stars
  c.circle(x + 34, y + h / 2, 17, BLUE);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c.circle(x + 34 + Math.sin(a) * 11, y + h / 2 - Math.cos(a) * 11, 1.6, YELLOW);
  }
  // Indonesian flag
  c.rect(x + 66, y + 12, 46, 13, [210, 40, 40]);
  c.rect(x + 66, y + 25, 46, 13, WHITE);
  c.rect(x + 66, y + 12, 46, 26, INK);
  c.rect(x + 67, y + 13, 44, 11, [210, 40, 40]);
  c.rect(x + 67, y + 24, 44, 12, WHITE);
  c.drawText("90.4%", "serifBold", 18, x + 122, y + h - 8, NAVY);
}
function medTAIEX(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, WHITE);
  for (let i = 1; i < 4; i++) c.line(x + 4, y + i * 12, x + w - 4, y + i * 12, 0.7, [220, 220, 215]);
  chartLine(c, [[x + 8, y + 10], [x + 50, y + 14], [x + 80, y + 12], [x + 120, y + 26], [x + 150, y + 24], [x + 185, y + 42]], RED, 2);
  c.drawText("−17.5%", "serifBold", 17, x + 6, y + h - 6, RED);
}
function medRugby(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, [46, 125, 50]);
  c.line(x, y + h - 10, x + w, y + h - 10, 1.2, WHITE);
  c.line(x + w * 0.5, y + 4, x + w * 0.5, y + h - 10, 1, WHITE);
  // goalposts
  const gx = x + w * 0.78;
  c.line(gx, y + 8, gx, y + 34, 2, WHITE);
  c.line(gx + 16, y + 8, gx + 16, y + 34, 2, WHITE);
  c.line(gx, y + 16, gx + 16, y + 16, 2, WHITE);
  c.circle(x + w * 0.3, y + h - 18, 6, [245, 240, 225]);
  c.drawText("37–12", "serifBold", 17, x + 6, y + h - 6, WHITE);
}
function medF1(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, [16, 16, 20]);
  // chequered flag
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    if ((i + j) % 2 === 0) c.rect(x + w - 34 + i * 8, y + 6 + j * 8, 8, 8, WHITE);
  }
  c.rect(x + w - 34, y + 6, 32, 16, INK);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    if ((i + j) % 2 === 0) c.rect(x + w - 34 + i * 8, y + 6 + j * 8, 8, 8, WHITE);
  }
  // F1 car silhouette
  const cx = x + 18, cy = y + 34;
  c.poly([[cx, cy], [cx + 30, cy - 4], [cx + 78, cy - 4], [cx + 100, cy + 2], [cx + 96, cy + 6], [cx + 10, cy + 6]], [200, 30, 30]);
  c.poly([[cx + 34, cy - 4], [cx + 48, cy - 12], [cx + 62, cy - 12], [cx + 66, cy - 4]], [160, 20, 20]);
  c.circle(cx + 24, cy + 6, 7, BLACK); c.circle(cx + 24, cy + 6, 3, [120, 120, 120]);
  c.circle(cx + 82, cy + 6, 7, BLACK); c.circle(cx + 82, cy + 6, 3, [120, 120, 120]);
  c.drawText("P1", "serifBold", 18, x + 6, y + h - 6, YELLOW);
}
function medPakistan(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, [238, 226, 205]);
  mountains(c, x, y + 8, w, h - 8, [150, 120, 80]);
  // crosshair target
  const tx = x + w * 0.72, ty = y + 20;
  c.circle(tx, ty, 10, RED);
  c.circle(tx, ty, 8, [238, 226, 205]);
  c.circle(tx, ty, 2.5, RED);
  c.line(tx - 14, ty, tx + 14, ty, 1.2, RED);
  c.line(tx, ty - 14, tx, ty + 14, 1.2, RED);
  badge(c, x + 4, y + h - 15, "15 KILLED", RED, WHITE, "sansBold", 10);
}
function medCAF(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, [46, 125, 50]);
  c.circle(x + w * 0.5, y + h / 2, 14, WHITE);
  c.circle(x + w * 0.5, y + h / 2, 14, INK);
  c.circle(x + w * 0.5, y + h / 2, 12.5, WHITE);
  c.poly([[x + w * 0.5 - 4, y + h / 2 - 3], [x + w * 0.5 + 4, y + h / 2 - 3], [x + w * 0.5 + 2, y + h / 2 + 4], [x + w * 0.5 - 2, y + h / 2 + 4]], INK);
  c.circle(x + w * 0.5 - 8, y + h / 2 - 7, 1.8, INK);
  c.circle(x + w * 0.5 + 8, y + h / 2 - 7, 1.8, INK);
  c.circle(x + w * 0.5, y + h / 2 + 9, 1.8, INK);
  c.line(x, y + h - 8, x + w, y + h - 8, 1, WHITE);
  c.drawText("54/54", "serifBold", 17, x + 6, y + h - 6, WHITE);
}
function medWallSt(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, [26, 26, 46]);
  for (let i = 1; i < 4; i++) c.line(x + 4, y + i * 12, x + w - 4, y + i * 12, 0.7, [60, 60, 80]);
  chartLine(c, [[x + 8, y + 12], [x + 45, y + 10], [x + 80, y + 18], [x + 115, y + 16], [x + 145, y + 28], [x + 182, y + 40]], BRIGHT_RED, 2);
  c.drawText("−10%", "serifBold", 17, x + 6, y + h - 6, [255, 90, 90]);
  c.drawText("NASDAQ WEEK", "sansBold", 7, x + 62, y + h - 7, [180, 180, 200]);
}

// ---------- world map ----------
type LatLon = [number, number];
const NA: LatLon[] = [[-166, 66], [-155, 58], [-140, 60], [-130, 54], [-125, 48], [-124, 40], [-120, 34], [-113, 29], [-106, 23], [-99, 20], [-94, 17], [-89, 13], [-84, 10], [-80, 8], [-79, 9], [-83, 9], [-87, 13], [-90, 16], [-91, 19], [-96, 19], [-97, 25], [-93, 29], [-88, 30], [-84, 30], [-82, 27], [-80, 25], [-80, 30], [-76, 35], [-74, 40], [-70, 42], [-66, 44], [-60, 46], [-55, 47], [-59, 50], [-63, 55], [-70, 58], [-77, 59], [-80, 55], [-85, 56], [-90, 58], [-93, 62], [-92, 66], [-100, 68], [-110, 68], [-120, 69], [-130, 69], [-140, 70], [-150, 70], [-160, 70], [-166, 68]];
const SA: LatLon[] = [[-79, 9], [-77, 4], [-78, 0], [-81, -4], [-80, -8], [-77, -12], [-75, -15], [-72, -18], [-70, -20], [-70, -23], [-70, -28], [-71, -32], [-72, -37], [-73, -42], [-73, -47], [-72, -50], [-70, -54], [-67, -55], [-65, -52], [-66, -49], [-66, -45], [-65, -41], [-62, -39], [-58, -35], [-54, -34], [-50, -30], [-48, -27], [-44, -23], [-41, -22], [-40, -20], [-39, -17], [-37, -13], [-35, -9], [-35, -6], [-38, -4], [-42, -3], [-44, -2], [-48, -1], [-50, 0], [-52, 3], [-55, 5], [-58, 7], [-61, 9], [-64, 10], [-68, 11], [-72, 12], [-75, 11], [-77, 10]];
const AF: LatLon[] = [[-6, 35], [-10, 31], [-15, 27], [-17, 21], [-17, 15], [-15, 11], [-12, 8], [-8, 5], [-4, 5], [0, 6], [4, 6], [8, 4], [9, 0], [9, -4], [12, -6], [13, -10], [12, -15], [13, -18], [14, -22], [16, -27], [18, -32], [20, -35], [26, -34], [28, -33], [31, -29], [33, -26], [35, -23], [36, -20], [35, -16], [36, -12], [40, -10], [41, -5], [42, -1], [44, 1], [46, 2], [48, 4], [51, 5], [51, 10], [48, 11], [44, 11], [42, 12], [40, 15], [38, 18], [37, 22], [35, 24], [33, 27], [32, 31], [30, 32], [27, 33], [22, 34], [19, 33], [15, 34], [11, 34], [10, 37], [6, 37], [0, 36], [-5, 35]];
const EU: LatLon[] = [[-9, 37], [-2, 37], [0, 39], [3, 42], [7, 44], [10, 44], [12, 45], [15, 44], [19, 42], [22, 40], [23, 38], [26, 38], [27, 37], [30, 36], [33, 36], [36, 36], [35, 33], [34, 31], [34, 28], [35, 27], [37, 24], [39, 21], [40, 18], [42, 15], [43, 12], [45, 13], [48, 14], [52, 15], [55, 17], [58, 20], [59, 23], [57, 26], [55, 26], [58, 25], [61, 25], [65, 25], [67, 24], [70, 22], [72, 20], [73, 16], [75, 13], [76, 10], [77, 8], [80, 9], [80, 13], [82, 16], [85, 19], [88, 22], [91, 22], [93, 20], [94, 17], [95, 15], [97, 15], [98, 13], [99, 10], [100, 7], [101, 4], [103, 2], [104, 3], [103, 6], [101, 9], [100, 12], [101, 13], [103, 10], [105, 9], [107, 11], [109, 14], [108, 17], [106, 20], [108, 21], [110, 21], [113, 22], [116, 23], [118, 25], [120, 28], [121, 31], [120, 34], [119, 36], [121, 38], [124, 40], [126, 40], [128, 42], [130, 43], [133, 44], [135, 46], [138, 48], [141, 51], [142, 54], [141, 58], [139, 60], [140, 64], [143, 65], [147, 66], [151, 66], [155, 67], [158, 66], [160, 63], [162, 60], [162, 56], [158, 53], [156, 51], [158, 55], [162, 58], [166, 60], [170, 62], [173, 65], [178, 66], [175, 68], [170, 68], [165, 68], [160, 69], [155, 70], [150, 70], [145, 71], [140, 71], [135, 71], [130, 71], [125, 72], [120, 72], [115, 72], [110, 73], [105, 74], [100, 74], [95, 74], [90, 73], [85, 72], [80, 72], [75, 71], [70, 71], [68, 70], [65, 69], [60, 68], [55, 67], [50, 67], [45, 67], [40, 66], [35, 66], [32, 68], [30, 70], [28, 70], [25, 70], [20, 69], [18, 68], [15, 66], [12, 64], [10, 62], [8, 60], [6, 58], [8, 57], [10, 55], [8, 54], [5, 53], [2, 51], [0, 49], [-2, 48], [-4, 48], [-2, 46], [-1, 44], [-2, 43], [-4, 41], [-9, 43]];
const UK: LatLon[] = [[-5, 50], [-3, 53], [-5, 56], [-3, 58], [-1, 57], [0, 53], [1, 51], [-2, 50]];
const JP: LatLon[] = [[130, 31], [132, 33], [134, 34], [136, 35], [138, 35], [140, 37], [141, 39], [141, 41], [143, 42], [145, 44], [143, 44], [141, 43], [140, 40], [139, 38], [137, 36], [135, 34], [133, 34], [131, 33]];
const AU: LatLon[] = [[113, -22], [114, -30], [115, -33], [118, -35], [124, -33], [129, -32], [132, -32], [135, -35], [138, -35], [140, -38], [145, -38], [150, -37], [153, -32], [153, -27], [150, -23], [146, -19], [142, -15], [142, -11], [140, -17], [136, -15], [135, -12], [132, -11], [130, -13], [128, -14], [126, -14], [124, -16], [122, -17], [120, -20], [117, -20], [114, -21]];
const ID_SUMATRA: LatLon[] = [[95, 5], [98, 3], [100, 0], [102, -3], [104, -5], [106, -6], [104, -5], [101, -2], [99, 1], [96, 4]];
const ID_BORNEO: LatLon[] = [[109, 1], [112, 3], [115, 5], [117, 3], [117, 0], [115, -3], [112, -4], [110, -2]];
const ID_JAVA: LatLon[] = [[105, -6], [108, -7], [111, -7], [114, -8], [114, -9], [110, -8], [107, -7]];
const ID_NG: LatLon[] = [[131, -1], [134, -2], [137, -3], [140, -4], [143, -5], [146, -6], [148, -8], [146, -8], [143, -7], [140, -5], [137, -3], [134, -2]];
const NZ: LatLon[] = [[167, -45], [170, -42], [173, -40], [175, -38], [177, -38], [175, -40], [173, -42], [170, -44], [167, -46]];
const MG: LatLon[] = [[44, -16], [47, -15], [50, -16], [49, -19], [47, -23], [45, -25], [44, -22], [43, -18]];

function project(x: number, y: number, w: number, h: number, lon: number, lat: number): [number, number] {
  return [x + ((lon + 170) / 360) * w, y + ((84 - lat) / 142) * h];
}
function drawContinent(c: Canvas, x: number, y: number, w: number, h: number, pts: LatLon[], col: RGB): void {
  c.poly(pts.map(([lon, lat]) => project(x, y, w, h, lon, lat)), col);
}
function worldMap(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, [214, 230, 236]);
  // graticule
  for (let lon = -150; lon <= 180; lon += 30) {
    const [px] = project(x, y, w, h, lon, 0);
    c.line(px, y, px, y + h, 0.7, [190, 205, 215]);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, py] = project(x, y, w, h, 0, lat);
    c.line(x, py, x + w, py, 0.7, [190, 205, 215]);
  }
  const LAND: RGB = [233, 220, 189];
  for (const cont of [NA, SA, AF, EU, UK, JP, AU, ID_SUMATRA, ID_BORNEO, ID_JAVA, ID_NG, NZ, MG])
    drawContinent(c, x, y, w, h, cont, LAND);
  // numbered pins 1-13 (heroes + mediums), jittered so Europe does not pile up
  const pins: [number, number, number, string, number, number][] = [
    [1, 26.2, 50.6, "Middle East", 0, 0],
    [2, 59.9, 24.5, "Europe", -2, -3],
    [3, 36.9, 30.7, "Global", 0, 0],
    [4, 47.9, 33.4, "Europe", 2, 3],
    [5, 25.6, -108.5, "Americas", 0, 0],
    [6, -11.2, -75.9, "Americas", 0, 0],
    [7, 50.8, 4.4, "South-East Asia", 6, -5],
    [8, 25.0, 121.6, "East Asia", 0, 0],
    [9, 51.4, -0.3, "Europe", -8, 4],
    [10, 36.2, -115.1, "Americas", 0, 0],
    [11, 29.8, 66.8, "South Asia", 0, 0],
    [12, 34.0, -6.8, "Africa", 0, 0],
    [13, 40.7, -74.0, "Americas", 0, 0],
  ];
  for (const [n, lat, lon, region, jx, jy] of pins) {
    const [px, py] = project(x, y, w, h, lon, lat);
    numPin(c, px + jx, py + jy, n, REGION_COLORS[region]);
  }
  // small dots for one-liner locations
  const dots: [number, number, string][] = [
    [45.3, 36.5, "Europe"], [50.5, 30.5, "Europe"], [52.2, 21.0, "Europe"], [59.3, 18.1, "Europe"],
    [30.5, 47.8, "Middle East"], [26.2, 56.2, "Middle East"], [35.7, 51.4, "Middle East"], [15.4, 44.2, "Middle East"],
    [38.9, -77.0, "Americas"], [45.4, -75.7, "Americas"], [-19.9, -43.9, "Americas"],
    [15.6, 32.5, "Africa"], [9.9, 6.0, "Africa"], [23.8, 90.4, "South Asia"],
    [37.8, 140.4, "East Asia"], [13.8, 100.5, "South-East Asia"],
    [-37.8, 145.0, "Oceania"], [-33.9, 151.2, "Oceania"],
  ];
  for (const [lat, lon, region] of dots) {
    const [px, py] = project(x, y, w, h, lon, lat);
    c.circle(px, py, 2.6, REGION_COLORS[region]);
    c.circle(px, py, 2.6, WHITE); c.circle(px, py, 1.8, REGION_COLORS[region]);
  }
}

// ---------- data ----------
type Story = { n: number; region: string; topic: string; pill: string; pillBg: RGB; head: string; sum: string; scene: (c: Canvas, x: number, y: number, w: number, h: number) => void };
const HEROES: { n: number; region: string; topic: string; pill: string; pillBg: RGB; head: string; sum: string; src: string; scene: (c: Canvas, x: number, y: number, w: number, h: number) => void }[] = [
  { n: 1, region: "Middle East", topic: "BAHRAIN · HORMUZ · CONFLICT", pill: "CLAIM · IRGC", pillBg: RED,
    head: "Iran strikes Bahrain bases; tankers hit off Oman",
    sum: "IRGC says it hit US radar at two bases; Bahrain says a civilian plant burned, no injuries.",
    src: "AL JAZEERA · REUTERS · AFP", scene: heroGulf },
  { n: 2, region: "Europe", topic: "GULF OF FINLAND · CONFLICT", pill: "CONFIRMED", pillBg: GREEN,
    head: "Drones set Russian cargo ship ablaze off Finland",
    sum: "Hit about 06:50 UTC, Sparta II drifted into Finnish waters; crew evacuated. Finland: Ukraine likely behind it.",
    src: "LOCAL REPORTS · YLE · BBC", scene: heroSparta },
  { n: 3, region: "Global", topic: "ANTALYA · CLIMATE", pill: "CONFIRMED · AP", pillBg: GREEN,
    head: "COP31 climate talks run into overtime",
    sum: "Talks in Antalya ran through Saturday over fossil fuels and finance; approval session set for Sunday 06:00 GMT.",
    src: "REUTERS · AP · FRANCE 24", scene: heroCOP },
];
const MEDIUMS: Story[] = [
  { n: 4, region: "Europe", topic: "KYIV · WAR", pill: "CONFIRMED · AP", pillBg: GREEN,
    head: "Russian missiles hit Zelenskyy's hometown", sum: "Double-tap strike; 2 killed, 60 hurt.", scene: medKryvyi },
  { n: 5, region: "Americas", topic: "SINALOA · CRIME", pill: "CONFIRMED · AP", pillBg: GREEN,
    head: "Mexico captures cartel boss 'El Chapo Isidro'", sum: "Seized in Guasave; $5m US reward.", scene: medSinaloa },
  { n: 6, region: "Americas", topic: "JUNIN · QUAKE", pill: "CONFIRMED · USGS", pillBg: GREEN,
    head: "Deep 6.7 quake shakes central Peru", sum: "Centred near Junin; felt in Lima.", scene: medPeru },
  { n: 7, region: "South-East Asia", topic: "BRUSSELS · TRADE", pill: "OFFICIAL · EU", pillBg: BLUE,
    head: "Indonesia and EU sign trade pact", sum: "Signed in Brussels after ten years.", scene: medEU },
  { n: 8, region: "East Asia", topic: "TAIPEI · MARKETS", pill: "OFFICIAL · FSC", pillBg: BLUE,
    head: "Taiwan curbs short-selling after rout", sum: "FSC acts after worst week since 1990.", scene: medTAIEX },
  { n: 9, region: "Europe", topic: "LONDON · RUGBY", pill: "CONFIRMED · AP", pillBg: GREEN,
    head: "England beat All Blacks 37–12", sum: "Record margin over New Zealand.", scene: medRugby },
  { n: 10, region: "Americas", topic: "LAS VEGAS · F1", pill: "OFFICIAL · F1", pillBg: BLUE,
    head: "Verstappen takes pole in Las Vegas", sum: "Antonelli fastest but docked 5 places.", scene: medF1 },
  { n: 11, region: "South Asia", topic: "BALOCHISTAN · SECURITY", pill: "REPORTED · PAKISTAN", pillBg: ORANGE,
    head: "Pakistan says 15 militants killed", sum: "Balochistan raids; arms seized.", scene: medPakistan },
  { n: 12, region: "Africa", topic: "RABAT · FOOTBALL", pill: "OFFICIAL · CAF", pillBg: BLUE,
    head: "All 54 CAF members back Infantino", sum: "FIFA vote set for March 2027, Rabat.", scene: medCAF },
  { n: 13, region: "Americas", topic: "NEW YORK · MARKETS", pill: "CONFIRMED · WSJ", pillBg: GREEN,
    head: "Wall Street correction confirmed", sum: "Nasdaq −10% for the week; $4tn wiped.", scene: medWallSt },
];
const ONE_LINERS: [number, string, string, string][] = [
  [14, "Europe", "Zelenskyy: Crimea Bridge 'will not stay'", "Kyiv Independent"],
  [15, "Europe", "EU greenlights €1bn military aid for Ukraine", "Kyiv Independent"],
  [16, "Europe", "NATO chief Rutte visits Poland after missiles land", "ISW"],
  [17, "Europe", "Sweden summons Russia's envoy over Kyiv blast", "Swedish govt"],
  [18, "Europe", "EU backs Poland over Russian airspace breach", "EU Council"],
  [19, "Middle East", "Fire at Iraqi power plant kills 4", "local reports"],
  [20, "Middle East", "Ship hit by mystery projectile off Khasab", "UKMTO"],
  [21, "Middle East", "Bahrain seeks UN action over Iran strikes", "Bahrain govt"],
  [22, "Middle East", "Araqchi wants diplomacy; Trump rejects terms", "IRNA / AP"],
  [23, "Middle East", "Houthis: 70+ Saudi bombing runs hit 8 areas", "Houthi statement"],
  [24, "Americas", "FBI crime database hacked for a second time", "FBI (investigating)"],
  [25, "Americas", "$22.5m haul in 'staggering' train heist", "police reports"],
  [26, "Americas", "Canada retail sales strongest since 2022", "Statistics Canada"],
  [27, "Americas", "Wolbachia mosquitoes cut dengue ~69% in Brazil", "AP"],
  [28, "Africa", "Blue Nile: Sudan army restoring security", "AA"],
  [29, "Africa", "Nigeria: bandits kill five in Niger State raid", "police"],
  [30, "South Asia", "Dhaka: two more die with measles symptoms", "TBS"],
  [31, "East Asia", "Japan: snow cuts off 1,000 in Fukushima village", "Kyodo"],
  [32, "South-East Asia", "Bangkok: six-point plan on arsenic in rivers", "Nation"],
  [33, "Oceania", "Cricket Australia backs Cummins as captain", "AFP"],
  [34, "Oceania", "Australia beat England by 3 wickets in T20", "Reuters"],
  [35, "Global", "Bitcoin falls below $59,000 on Saturday", "CoinGecko"],
];
const STATS: [string, string][] = [
  ["2", "US bases Iran says it struck"],
  ["60", "wounded in the Kryvyi Rih strike"],
  ["11", "killed in the Sinaloa capture raid"],
  ["6.7", "magnitude of the Peru quake (USGS)"],
  ["−10%", "Nasdaq week, worst since Mar 2020"],
  ["90.4%", "tariff lines duty-free in EU pact"],
];
const TIMELINE: [string, string][] = [
  ["OVERNIGHT", "Missiles hit Kryvyi Rih"],
  ["00:09", "6.7 quake strikes Peru"],
  ["01:00", "'El Chapo Isidro' captured"],
  ["06:50", "Sparta II hit by drones"],
  ["MORNING", "COP31 talks resume, no deal"],
  ["EVENING", "Iran strikes Bahrain bases"],
];

// ---------- page build ----------
function build(): Canvas {
  const c = new Canvas();
  c.fill(...PAPER);
  const MX = 12, CW = 1000;

  // top bar
  c.rect(0, 0, 1024, 17, BLACK);
  c.drawText("THE WORLD IN ONE DAY", "sansBold", 9, MX, 12, WHITE);
  c.drawText("DAY 325 OF 2026", "sansBold", 9, 512 - textWidth("DAY 325 OF 2026", "sansBold", 9) / 2, 12, [224, 90, 90]);
  const rt = "ALL TIMES UTC · RANKED BY CONSEQUENCE";
  c.drawText(rt, "sansBold", 9, 1012 - textWidth(rt, "sansBold", 9), 12, WHITE);

  // masthead
  const mast = "Saturday 21 November 2026";
  c.drawText(mast, "black", 60, 512, 70, INK, "c");
  c.rect(MX, 76, CW, 2, INK);
  c.rect(MX, 79, CW, 1, INK);
  const counts = "35 STORIES · 9 REGIONS · EVERY ONE DATED SATURDAY 21 NOVEMBER 2026";
  c.drawText(counts, "sansBold", 11, 512, 92, RED, "c");
  const sub = "Iran strikes Bahrain as tankers hit in Hormuz — Drones set Russian cargo ship ablaze off Finland — COP31 deadlocked over fossil fuels in overtime";
  c.drawText(sub, "serifItalic", 14.5, 512, 109, INK, "c");

  // timeline strip
  const ty = 114;
  c.rect(MX, ty, 96, 28, BLACK);
  c.drawText("THE DAY", "sansBold", 8, MX + 6, ty + 11, WHITE);
  c.drawText("IN UTC", "sansBold", 8, MX + 52, ty + 11, [224, 90, 90]);
  c.drawText("ALL TIMES UTC", "sans", 7, MX + 6, ty + 23, [180, 180, 180]);
  const slotW = (CW - 96) / 6;
  for (let i = 0; i < 6; i++) {
    const sx = MX + 96 + i * slotW;
    c.line(sx, ty + 3, sx, ty + 25, 0.8, [200, 200, 190]);
    c.circle(sx + 8, ty + 8, 2.4, RED);
    c.drawText(TIMELINE[i][0], "sansBold", 8.5, sx + 14, ty + 11, RED);
    c.drawText(TIMELINE[i][1], "sans", 8.5, sx + 14, ty + 23, INK);
  }
  c.rect(MX, ty + 28, CW, 1, INK);

  // 6-stat strip (single-line captions so nothing wraps onto the region bar)
  const sy = 146, sw = CW / 6;
  for (let i = 0; i < 6; i++) {
    const sx = MX + i * sw;
    if (i > 0) c.line(sx, sy + 3, sx, sy + 30, 1, [200, 195, 180]);
    c.drawText(STATS[i][0], "serifBold", 24, sx + 6, sy + 21, i === 4 ? RED : NAVY);
    c.drawText(STATS[i][1], "sans", 8.5, sx + 6, sy + 31, INK);
  }
  c.rect(MX, sy + 34, CW, 1, INK);

  // region bar
  const ry = 184;
  c.rect(MX, ry, 108, 16, BLACK);
  c.drawText("STORIES BY REGION", "sansBold", 8, MX + 6, ry + 11.5, WHITE);
  let rx = MX + 108;
  const barW = CW - 108;
  for (const [name, n] of REGION_COUNTS) {
    const wseg = (n / 35) * barW;
    c.rect(rx, ry, wseg, 16, REGION_COLORS[name]);
    const label = name === "South-East Asia" ? "SE Asia 2" : `${name} ${n}`;
    if (textWidth(label, "sansBold", 8) + 8 <= wseg)
      c.drawText(label, "sansBold", 8, rx + wseg / 2, ry + 11.5, WHITE, "c");
    rx += wseg;
  }

  // heroes
  const hy = 202, hw = 324, hgap = 14;
  for (let i = 0; i < 3; i++) {
    const h = HEROES[i];
    const hx = MX + i * (hw + hgap);
    h.scene(c, hx, hy, hw, 138);
    c.rect(hx, hy, hw, 1, INK); c.rect(hx, hy + 137, hw, 1, INK);
    c.rect(hx, hy, 1, 138, INK); c.rect(hx + hw - 1, hy, 1, 138, INK);
    // label bar
    const ly = hy + 142;
    numPin(c, hx + 9, ly + 7, h.n, REGION_COLORS[h.region], 7.5);
    c.drawText(h.topic, "sansBold", 8, hx + 20, ly + 10, INK);
    const pw = badge(c, hx + hw - textWidth(h.pill, "sansBold", 7.5) - 10, ly, h.pill, h.pillBg, WHITE, "sansBold", 7.5);
    void pw;
    // headline
    const hl = wrapText(h.head, "serifBold", 19, hw);
    for (let j = 0; j < hl.length; j++) c.drawText(hl[j], "serifBold", 19, hx, ly + 32 + j * 21, INK);
    // summary
    const sl = wrapText(h.sum, "serif", 11.5, hw);
    for (let j = 0; j < sl.length && j < 2; j++) c.drawText(sl[j], "serif", 11.5, hx, ly + 82 + j * 13, [40, 40, 40]);
    // source
    c.drawText(h.src, "sans", 8, hx, ly + 106, GRAY);
  }

  // mediums 5x2
  const mw = 193, mgap = 8.75, my0 = 436;
  for (let i = 0; i < 10; i++) {
    const m = MEDIUMS[i];
    const col = i % 5, row = Math.floor(i / 5);
    const mx = MX + col * (mw + mgap);
    const my = my0 + row * 106;
    m.scene(c, mx, my, mw, 50);
    c.rect(mx, my, mw, 1, INK); c.rect(mx, my + 49, mw, 1, INK);
    c.rect(mx, my, 1, 50, INK); c.rect(mx + mw - 1, my, 1, 50, INK);
    const ly = my + 53;
    numPin(c, mx + 8, ly + 6, m.n, REGION_COLORS[m.region], 6.5);
    c.drawText(m.topic, "sansBold", 7.5, mx + 17, ly + 9, INK);
    badge(c, mx + mw - textWidth(m.pill, "sansBold", 7) - 8, ly, m.pill, m.pillBg, WHITE, "sansBold", 7);
    const hl = wrapText(m.head, "serifBold", 12.5, mw);
    for (let j = 0; j < hl.length && j < 2; j++) c.drawText(hl[j], "serifBold", 12.5, mx, ly + 26 + j * 14, INK);
    const sl = wrapText(m.sum, "serif", 9.5, mw);
    if (sl[0]) c.drawText(sl[0], "serif", 9.5, mx, ly + 52, [40, 40, 40]);
  }

  // bottom headers
  const by = 652;
  c.drawText("WHERE IT HAPPENED", "sansBold", 11, MX, by + 8, INK);
  c.drawText("pins 1–13 match the illustrated stories", "serifItalic", 9, MX + 138, by + 8, GRAY);
  const oneX = 358;
  c.drawText("ALSO ON SATURDAY 21 NOVEMBER 2026 — 22 MORE", "sansBold", 11, oneX, by + 8, INK);
  c.line(MX, by + 12, 1012, by + 12, 1, INK);

  // world map (left) + legend
  const mapY = 668, mapH = 176;
  worldMap(c, MX, mapY, 330, mapH);
  c.rect(MX, mapY, 330, 1, INK); c.rect(MX, mapY + mapH - 1, 330, 1, INK);
  c.rect(MX, mapY, 1, mapH, INK); c.rect(MX + 329, mapY, 1, mapH, INK);
  const legY = mapY + mapH + 4;
  let lx = MX;
  for (const [name] of REGION_COUNTS) {
    c.rect(lx, legY, 7, 7, REGION_COLORS[name]);
    const tw = textWidth(name, "sans", 7.5);
    c.drawText(name, "sans", 7.5, lx + 9, legY + 7, INK);
    lx += 11 + tw + 7;
    if (lx > MX + 240) { lx = MX; }
  }
  // second legend row is drawn by wrapping: recompute cleanly in two rows
  // (row 1: Europe..South Asia, row 2: East Asia..Global) — draw over with paper first
  c.rect(MX, legY - 2, 330, 26, PAPER);
  const legRows: string[][] = [
    ["Europe", "Middle East", "Americas", "Africa", "South Asia"],
    ["East Asia", "South-East Asia", "Oceania", "Global"],
  ];
  for (let r = 0; r < 2; r++) {
    let x = MX;
    for (const name of legRows[r]) {
      c.rect(x, legY + r * 11, 7, 7, REGION_COLORS[name]);
      c.drawText(name, "sans", 7.5, x + 9, legY + r * 11 + 7, INK);
      x += 11 + textWidth(name, "sans", 7.5) + 8;
    }
  }

  // one-liners (right, 2 columns x 11) — each shortened to one line
  const colW = 318, colGap = 18;
  for (let i = 0; i < 22; i++) {
    const [n, region, text, src] = ONE_LINERS[i];
    const col = Math.floor(i / 11), row = i % 11;
    const ox = oneX + col * (colW + colGap);
    const oy = mapY + row * 16;
    c.circle(ox + 7, oy + 4, 6.5, REGION_COLORS[region]);
    const ns = String(n);
    c.drawText(ns, "sansBold", 7, ox + 7 - textWidth(ns, "sansBold", 7) / 2, oy + 6.5, WHITE);
    const full = `${text} — ${src}`;
    const lines = wrapText(full, "serif", 9.5, colW - 18);
    for (let j = 0; j < lines.length && j < 2; j++)
      c.drawText(lines[j], "serif", 9.5, ox + 16, oy + 7.5 + j * 9.5, INK);
  }

  // DATE CHECK
  const dy = 872;
  c.rect(MX, dy, CW, 92, [253, 245, 238]);
  c.rect(MX, dy, CW, 2, RED); c.rect(MX, dy + 90, CW, 2, RED);
  c.rect(MX, dy, 2, 92, RED); c.rect(MX + CW - 2, dy, 2, 92, RED);
  c.rect(MX + 4, dy + 4, 86, 15, RED);
  c.drawText("DATE CHECK", "sansBold", 9.5, MX + 10, dy + 15.5, WHITE);
  c.drawText("Well-known stories left out: they belong to another day (UTC).", "serifItalic", 10, MX + 98, dy + 15.5, INK);
  const dcLines = [
    "Fri 20 Nov — Russia's 500-weapon barrage hits three Kyiv bridges; Cyclone Akvan makes landfall in Odisha, India; the S&P 500's −3.7% Friday close itself (Saturday's story is the correction verdict, not the close).",
    "Thu 19 Nov — World Court rules Myanmar committed genocide against the Rohingya; Anthropic's $2tn IPO debut; Trump–Putin–Xi Shenzhen summit and “declaration of peace”.",
    "Not yet — had not happened by end of Sat 21 Nov: COP31 final deal (new package expected Sun 22 Nov); Nepal PM Bhandari's India visit (22–23 Nov).",
    "Corrections — Peru quake depth differs by agency: USGS 108 km, IGP 129 km. Early reports put the quake at 6.9; USGS revised it to 6.7. Dhaka: 2 deaths, not 5.",
    "Every story here happened or was first reported on Saturday 21 November 2026.",
  ];
  let dyy = dy + 30;
  for (const line of dcLines) {
    const wrapped = wrapText(line, "serif", 10, CW - 24);
    for (const wl of wrapped) {
      c.drawText(wl, "serif", 10, MX + 10, dyy, INK);
      dyy += 11;
    }
  }

  // HOW SURE legend
  const hy2 = 970;
  c.rect(MX, hy2, 62, 13, BLACK);
  c.drawText("HOW SURE", "sansBold", 8, MX + 6, hy2 + 9.5, WHITE);
  const sure = "CONFIRMED — 2+ major outlets      OFFICIAL — on the record: agency, ministry, federation      REPORTED — one major outlet";
  c.drawText(sure, "sans", 8.5, MX + 70, hy2 + 9.5, INK);

  // footer
  const fy = 988;
  c.line(MX, fy, 1012, fy, 1, INK);
  c.drawText("Sources: AP, Reuters, AFP, Al Jazeera, NYT, WSJ, CNN, Kyiv Independent, Xinhua, NPR, Le Monde, UKMTO, USGS.", "sans", 8.5, MX, fy + 11, GRAY);
  c.drawText("Sources named beside each story · All maps and drawings are original vector work.", "sans", 8.5, 1012, fy + 11, GRAY, "r");
  c.drawText("Every story here happened or was first reported on Saturday 21 November 2026 (UTC), told as the named outlets reported it.", "serifItalic", 9, 512, fy + 22, INK, "c");

  return c;
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const png = build().toPNG();
writeFileSync(`${outDir}/entry.png`, png);
console.log(`wrote ${outDir}/entry.png ${png.length} bytes in ${Date.now() - t0}ms`);
