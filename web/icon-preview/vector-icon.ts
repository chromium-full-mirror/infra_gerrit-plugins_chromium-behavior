/**
 * @license
 * Copyright 2026 The Chromium Authors
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * Converts Chromium vector icon (.icon) text into standalone SVG strings.
 *
 * Spec / source of truth:
 *   ui/gfx/vector_icon_types.h   (command list)
 *   ui/gfx/vector_icon_utils.cc  (argument counts, text parsing)
 *   ui/gfx/paint_vector_icon.cc  (drawing semantics)
 */

/**
 * For each command: its argument count (GetCommandArgumentCount() in
 * vector_icon_utils.cc) and, for path commands, the SVG path letter. Path
 * arguments map 1:1, so SVG handles relative coordinates and shorthand curves.
 */
const COMMANDS = {
  NEW_PATH: [0],
  FILL_RULE_NONZERO: [0],
  PATH_COLOR_ALPHA: [1],
  PATH_COLOR_ARGB: [4],
  PATH_MODE_CLEAR: [0],
  STROKE: [1],
  CAP_SQUARE: [0],
  MOVE_TO: [2, 'M'],
  R_MOVE_TO: [2, 'm'],
  ARC_TO: [7, 'A'],
  R_ARC_TO: [7, 'a'],
  LINE_TO: [2, 'L'],
  R_LINE_TO: [2, 'l'],
  H_LINE_TO: [1, 'H'],
  R_H_LINE_TO: [1, 'h'],
  V_LINE_TO: [1, 'V'],
  R_V_LINE_TO: [1, 'v'],
  CUBIC_TO: [6, 'C'],
  R_CUBIC_TO: [6, 'c'],
  CUBIC_TO_SHORTHAND: [4, 'S'],
  QUADRATIC_TO: [4, 'Q'],
  R_QUADRATIC_TO: [4, 'q'],
  QUADRATIC_TO_SHORTHAND: [2, 'T'],
  R_QUADRATIC_TO_SHORTHAND: [2, 't'],
  CIRCLE: [3],
  OVAL: [4],
  ROUND_RECT: [5],
  CLOSE: [0, 'Z'],
  CANVAS_DIMENSIONS: [1],
  CLIP: [4],
  DISABLE_AA: [0],
  FLIPS_IN_RTL: [0],
} satisfies Record<string, readonly [number, string?]>;

export type Command = keyof typeof COMMANDS;
const NAMES: ReadonlySet<string> = new Set(Object.keys(COMMANDS));

function spec(cmd: Command): readonly [number, string?] {
  return COMMANDS[cmd];
}

export interface Op {
  cmd: Command;
  args: number[];
}

export interface Rep {
  size: number;
  ops: Op[];
}

export const LIMITS = {
  maxInputBytes: 256 * 1024,
  maxReps: 8,
  maxCanvas: 1024, // largest in tree today: 960
  maxAbsValue: 10_000,
};

const DECIMAL_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d{1,3})?f?$/;
const HEX_RE = /^0x[0-9a-fA-F]{1,8}$/;

class IconError extends Error {}

function parseNumber(tok: string): number {
  let n: number;
  if (HEX_RE.test(tok)) {
    n = parseInt(tok.slice(2), 16);
  } else if (DECIMAL_RE.test(tok)) {
    n = Number(tok.endsWith('f') ? tok.slice(0, -1) : tok);
  } else {
    throw new IconError('unexpected token');
  }
  if (Math.abs(n) > LIMITS.maxAbsValue) {
    throw new IconError('number out of range');
  }
  return n;
}

/**
 * Parses .icon text. Mirrors gfx::ParsePathElements() and
 * aggregate_vector_icons.py: comments are stripped, tokens are separated by
 * ',' or ' ', and every CANVAS_DIMENSIONS starts a new representation.
 */
export function parseIcon(text: string): Rep[] {
  if (text.length > LIMITS.maxInputBytes) throw new IconError('file too large');

  const tokens: string[] = [];
  // .icon lines are pasted into C++ by aggregate_vector_icons.py, which
  // strips "//" comments anywhere on a line; /* */ block comments are also
  // legal C++ and appear in the tree. Comment text is discarded entirely.
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (stripped.includes('/*')) throw new IconError('unterminated comment');
  for (const rawLine of stripped.split('\n')) {
    const line = rawLine.split('//')[0].trim();
    if (!line) continue;
    for (const t of line.split(/[, ]+/)) {
      const tok = t.trim();
      if (!tok) continue;
      tokens.push(tok);
    }
  }

  const reps: Rep[] = [];
  let i = 0;
  while (i < tokens.length) {
    const name = tokens[i];
    if (!NAMES.has(name)) throw new IconError('unknown command');
    const cmd = name as Command;
    const [n] = spec(cmd);
    const args: number[] = [];
    for (let k = 1; k <= n; k++) {
      const tok = tokens[i + k];
      if (tok === undefined) {
        throw new IconError(`wrong number of arguments for ${cmd}`);
      }
      args.push(parseNumber(tok));
    }
    i += n + 1;

    if (cmd === 'CANVAS_DIMENSIONS' || reps.length === 0) {
      if (reps.length >= LIMITS.maxReps) throw new IconError('too many sizes');
      reps.push({size: 48, ops: []}); // kReferenceSizeDip default
    }
    const rep = reps[reps.length - 1];
    if (cmd === 'CANVAS_DIMENSIONS') {
      const size = Math.trunc(args[0]);
      if (size <= 0 || size > LIMITS.maxCanvas) {
        throw new IconError('canvas size out of range');
      }
      rep.size = size;
    }
    rep.ops.push({cmd, args});
  }
  if (reps.length === 0) throw new IconError('empty icon');
  return reps;
}

function fmt(n: number): string {
  const r = Math.round(n * 1e4) / 1e4;
  return String(Object.is(r, -0) ? 0 : r);
}

function clampByte(n: number): number {
  const v = Math.floor(n);
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

interface PathState {
  d: string[];
  nonzero: boolean;
  color: [number, number, number, number]; // a, r, g, b (0..255)
  clear: boolean;
  stroke: number | null;
  capSquare: boolean;
  noAA: boolean;
}

export const DEFAULT_COLOR: [number, number, number, number] = [
  255, 0x5f, 0x63, 0x68,
];

/** Ellipse as a closed path, clockwise from (right, center) like Skia. */
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  const arc = `A${fmt(rx)} ${fmt(ry)} 0 1 1`;
  return (
    `M${fmt(cx + rx)} ${fmt(cy)}${arc} ${fmt(cx - rx)} ${fmt(cy)}` +
    `${arc} ${fmt(cx + rx)} ${fmt(cy)}Z`
  );
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(Math.max(0, r), w / 2, h / 2);
  const arc = `A${fmt(r)} ${fmt(r)} 0 0 1`;
  return (
    `M${fmt(x + r)} ${fmt(y)}H${fmt(x + w - r)}${arc} ${fmt(x + w)} ${fmt(
      y + r,
    )}` +
    `V${fmt(y + h - r)}${arc} ${fmt(x + w - r)} ${fmt(y + h)}` +
    `H${fmt(x + r)}${arc} ${fmt(x)} ${fmt(y + h - r)}` +
    `V${fmt(y + r)}${arc} ${fmt(x + r)} ${fmt(y)}Z`
  );
}

/** Converts one representation into an SVG document string. */
export function repToSvg(rep: Rep, color = DEFAULT_COLOR): string {
  const paths: PathState[] = [];
  let clip: number[] | null = null;

  for (const {cmd, args: a} of rep.ops) {
    if (paths.length === 0 || cmd === 'NEW_PATH') {
      paths.push({
        d: [],
        nonzero: false,
        color: [...color] as [number, number, number, number],
        clear: false,
        stroke: null,
        capSquare: false,
        noAA: false,
      });
    }
    const p = paths[paths.length - 1];

    const [, letter] = spec(cmd);
    if (letter) {
      // SVG arc flags must be exactly 0 or 1.
      const args =
        letter.toUpperCase() === 'A'
          ? [a[0], a[1], a[2], a[3] ? 1 : 0, a[4] ? 1 : 0, a[5], a[6]]
          : a;
      p.d.push(letter + args.map(fmt).join(' '));
      continue;
    }

    switch (cmd) {
      case 'CIRCLE':
        p.d.push(ellipse(a[0], a[1], Math.abs(a[2]), Math.abs(a[2])));
        break;
      case 'OVAL':
        p.d.push(ellipse(a[0], a[1], Math.abs(a[2]), Math.abs(a[3])));
        break;
      case 'ROUND_RECT':
        p.d.push(
          roundRect(a[0], a[1], Math.max(0, a[2]), Math.max(0, a[3]), a[4]),
        );
        break;
      case 'FILL_RULE_NONZERO':
        p.nonzero = true;
        break;
      case 'PATH_COLOR_ALPHA':
        p.color[0] = clampByte(a[0]);
        break;
      case 'PATH_COLOR_ARGB':
        p.color = [
          clampByte(a[0]),
          clampByte(a[1]),
          clampByte(a[2]),
          clampByte(a[3]),
        ];
        break;
      case 'PATH_MODE_CLEAR':
        p.clear = true;
        break;
      case 'STROKE':
        p.stroke = Math.max(0, a[0]);
        break;
      case 'CAP_SQUARE':
        p.capSquare = true;
        break;
      case 'DISABLE_AA':
        p.noAA = true;
        break;
      case 'CLIP':
        clip = a;
        break;
      default:
        // NEW_PATH, CANVAS_DIMENSIONS, FLIPS_IN_RTL: nothing to draw.
        break;
    }
  }

  // Assemble. Later PATH_MODE_CLEAR paths erase everything drawn before them,
  // implemented as a mask over the previously drawn content.
  const S = rep.size;
  let body = '';
  let maskId = 0;
  for (const p of paths) {
    if (p.d.length === 0) continue;
    if (p.clear) {
      const id = `m${maskId++}`;
      body =
        `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}">` +
        `<rect x="0" y="0" width="${S}" height="${S}" fill="#ffffff"/>` +
        pathEl(p, 'rgba(0,0,0,1)') +
        `</mask><g mask="url(#${id})">${body}</g>`;
      continue;
    }
    const [al, r, g, b] = p.color;
    body += pathEl(p, `rgba(${r},${g},${b},${fmt(al / 255)})`);
  }
  if (clip) {
    body =
      `<clipPath id="c0"><rect x="${fmt(clip[0])}" y="${fmt(clip[1])}" ` +
      `width="${fmt(Math.max(0, clip[2]))}" height="${fmt(
        Math.max(0, clip[3]),
      )}"/></clipPath>` +
      `<g clip-path="url(#c0)">${body}</g>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" ` +
    `width="${S}" height="${S}">${body}</svg>`
  );
}

function pathEl(p: PathState, paint: string): string {
  const d = p.d.join('');
  const aa = p.noAA ? 'crispEdges' : 'geometricPrecision';
  if (p.stroke !== null) {
    return (
      `<path d="${d}" fill="none" stroke="${paint}" stroke-width="${fmt(
        p.stroke,
      )}" ` +
      `stroke-linecap="${
        p.capSquare ? 'square' : 'round'
      }" shape-rendering="${aa}"/>`
    );
  }
  return (
    `<path d="${d}" fill="${paint}" fill-rule="${
      p.nonzero ? 'nonzero' : 'evenodd'
    }" ` + `shape-rendering="${aa}"/>`
  );
}

export interface IconPreview {
  size: number;
  svg: string;
}

export function iconToSvgs(
  text: string,
): {svgs: IconPreview[]} | {error: string} {
  try {
    const svgs = parseIcon(text).map(r => {
      return {size: r.size, svg: repToSvg(r)};
    });
    return {svgs};
  } catch (e) {
    return {error: e instanceof IconError ? e.message : 'internal error'};
  }
}
