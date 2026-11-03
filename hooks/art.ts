// field-badges: the art, as SVG strings. Pure functions with no imports, so a preview script can
// run them. Plain shapes, paths and SMIL only (no filter, pattern, style or gradient, whose fate in
// the desktop's scrub is undocumented). Mid-tone colours that read on a light and a dark page.

export type Frame = 'round' | 'shield' | 'hex'
export type PinLook = 'earned' | 'locked' | 'hidden'

const RIM = '#c5c9ce'
const RIM_EDGE = '#6a7078'
const INK = '#fbf3e2'
const RED = '#d4524a'
const GREEN = '#6cc07a'
const GREY_RIM = '#b4b0a7'
const GREY_EDGE = '#8e8a82'
const GREY_FILL = '#cbc6bc'
const GREY_INK = '#9c978d'
const PAGE = '#e7dfcc'
const PAGE_EDGE = '#b8aa8a'
const TEXT = '#3b3226'
const SUBTLE = '#6d6250'
const FONT = "system-ui, 'Segoe UI', Helvetica, Arial, sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"
const NS = 'xmlns="http://www.w3.org/2000/svg"'

/** Each frame in a 64 x 64 box: the metal rim, the enamel inside it, and a shine stroke. */
const FRAMES: Record<Frame, { outer: string; inner: string; shine: string }> = {
  round: {
    outer: 'M3 32a29 29 0 1 0 58 0a29 29 0 1 0-58 0Z',
    inner: 'M9 32a23 23 0 1 0 46 0a23 23 0 1 0-46 0Z',
    shine: 'M15.5 24a18 18 0 0 1 12-11',
  },
  shield: {
    outer: 'M32 3L57 11V30C57 46 46 56 32 61C18 56 7 46 7 30V11Z',
    inner: 'M32 9L51 15.5V30C51 42 43 50.5 32 55C21 50.5 13 42 13 30V15.5Z',
    shine: 'M17 19.5L29 15.5',
  },
  hex: {
    outer: 'M32 3L57.1 17.5V46.5L32 61L6.9 46.5V17.5Z',
    inner: 'M32 9L51.9 20.5V43.5L32 55L12.1 43.5V20.5Z',
    shine: 'M16 22.5L29 15',
  },
}

/** A round-capped stroke in the glyph colour. */
const s = (w: number): string => `fill="none" stroke="$I" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`

/**
 * One original glyph per badge, drawn in the 64 x 64 box's middle. `$I` is the glyph colour, `$D`
 * the enamel's dark shade, `$R` and `$G` the red and the green; a locked pin greys them all.
 */
export const GLYPHS: Readonly<Record<string, string>> = {
  'first-stitch': `<path d="M13 32H24M40 32H51" ${s(3.5)}/><circle cx="32" cy="32" r="7.5" ${s(3.5)}/>`,
  'sent-off': `<path d="M32 17L44 30H36.5V45H27.5V30H20Z" fill="$I"/>`,
  'ribbon-cut': `<path d="M32 30L19 21V39ZM32 30L45 21V39Z" fill="$I"/><path d="M29 33L24 46M35 33L40 46" ${s(3)}/><circle cx="32" cy="30" r="3.5" fill="$D"/>`,
  'bridge-builder': `<path d="M13 40H51M17 40C21 27 43 27 47 40M24 40V33.5M32 40V31M40 40V33.5" ${s(3)}/>`,
  untangler: `<path d="M15 26C20 18 24 34 29 26S38 18 43 26 49 30 49 30" ${s(3)}/><path d="M15 40H49" ${s(3)}/>`,
  'knot-tied': `<path d="M23 20V27C23 34 32 33 32 40V45M41 20V27C41 34 32 33 32 40" ${s(3)}/><circle cx="23" cy="18" r="3.2" fill="$I"/><circle cx="41" cy="18" r="3.2" fill="$I"/><circle cx="32" cy="47" r="3.2" fill="$I"/>`,
  'second-draft': `<path d="M20 44L22 36L39 19L45 25L28 42Z" fill="$I"/><path d="M36 22L42 28" stroke="$D" stroke-width="2"/><path d="M20 44L22 36L28 42Z" fill="$D"/>`,
  'cherry-picker': `<path d="M25 35C27 26 31 21 37 17M39 37C38 29 37 23 37 17" ${s(2.5)}/><path d="M37 17C41 14 46 15 47 18C43 20 40 19 37 17Z" fill="$I"/><circle cx="25" cy="40" r="6" fill="$R"/><circle cx="39" cy="42" r="6" fill="$R"/>`,

  'first-light': `<path d="M18 41A14 14 0 0 1 46 41Z" fill="$I"/><path d="M32 17V21M20 23L22.5 25.5M44 23L41.5 25.5M14 33H17M47 33H50M14 46H50" ${s(3)}/>`,
  'red-to-green': `<circle cx="20" cy="32" r="7.5" fill="$R"/><circle cx="44" cy="32" r="7.5" fill="$G"/><path d="M28.5 32H35M32 28.5L35.5 32L32 35.5" ${s(2.5)}/>`,
  'true-square': `<rect x="19" y="19" width="26" height="26" rx="2" ${s(3.5)}/><path d="M25 32L30 37L39 27" ${s(3.5)}/>`,
  'smooth-plane': `<path d="M15.5 42H48.5L45.5 35H17.5Z" fill="$I"/><path d="M18.5 35C17.5 29.5 20.5 25 25 24.5C28 24.2 29 26.5 27.5 28.5C26 30.5 26.5 32.5 27.5 35Z" fill="$I"/><circle cx="42.5" cy="32" r="3.2" fill="$I"/><path d="M31 35L35 26" ${s(3)}/><path d="M36.5 34.5C37 29.5 40.5 27.5 41.5 23.5C42.2 20.5 38.5 19.5 37.8 22.3" ${s(2)}/><path d="M20 46.5H44" ${s(2)}/>`,
  'fresh-gauge': `<path d="M27 17H37M29 17V28L19 45H45L35 28V17" ${s(3)}/><path d="M23 39H41L38.5 35H25.5Z" fill="$I"/>`,

  shipwright: `<circle cx="32" cy="19" r="4" ${s(3)}/><path d="M32 23V47M23 31H41M18 38C20 45 27 48 32 48S44 45 46 38" ${s(3)}/>`,
  'fleet-return': `<path d="M17 37L23 23V37ZM29 37L35 20V37ZM41 37L47 25V37Z" fill="$I"/><path d="M14 42C18 40 21 44 25 42S32 40 36 42 43 44 50 42" ${s(2.5)}/>`,
  'long-voyage': `<path d="M32 15L36 32L32 49L28 32Z" fill="$I"/><path d="M15 32L32 28L49 32L32 36Z" fill="$I" fill-opacity=".7"/><circle cx="32" cy="32" r="3" fill="$D"/>`,
  'hands-free': `<path d="M32 14L42 28L32 42L22 28Z" fill="$I"/><path d="M22 28H42M32 14V42" stroke="$D" stroke-width="1.5"/><path d="M32 42C29 46 35 47 32 51" ${s(2)}/>`,

  'clocked-in': `<circle cx="32" cy="32" r="13" ${s(3.5)}/><path d="M32 24V32H38.5" ${s(3)}/>`,
  'long-haul': `<path d="M32 14V18M27 18H37M24 45H40" ${s(2.5)}/><rect x="25" y="20" width="14" height="22" rx="3" ${s(3)}/><path d="M32 26C35 30 35 34 32 37C29 34 29 30 32 26Z" fill="$I"/>`,
  'second-wind': `<path d="M15 27H36C42 27 42 19 37 19C33 19 33 23 34 24M15 34H44C50 34 50 43 44 43C40 43 39 39 41 38M15 41H30" ${s(3)}/>`,
  'clean-sweep': `<path d="M44 14L33 33" ${s(3.5)}/><path d="M27 31L38 37L32 50L18 45Z" fill="$I"/><path d="M23 46L27 40M28 48L31 42" stroke="$D" stroke-width="1.5"/>`,

  'first-mate': `<circle cx="32" cy="24" r="6.5" fill="$I"/><path d="M19 46C19 36 45 36 45 46Z" fill="$I"/>`,
  lookout: `<path d="M16 37L41 24L44 30L19 43Z" fill="$I"/><path d="M41 24L46 21.5L49 27.5L44 30Z" fill="$I"/><path d="M31 36L25 48M31 36L37 48" ${s(2.5)}/>`,
  conductor: `<circle cx="25" cy="40" r="5" fill="$I"/><circle cx="40" cy="36" r="5" fill="$I"/><path d="M30 40V21L45 17V36M30 26L45 22" ${s(3)}/>`,

  'blank-page': `<path d="M22 15H36L44 23V49H22Z" ${s(3)}/><path d="M36 15V23H44" ${s(3)}/>`,
  'lean-cut': `<path d="M16 22H40V38H22C19 38 16 35 16 32Z" fill="$I"/><path d="M40 28H49" ${s(4)}/><circle cx="21" cy="27" r="2" fill="$D"/>`,
  bridgewalker: `<rect x="12" y="23" width="15" height="15" rx="1.5" ${s(2.5)}/><path d="M19.5 23V38M12 30.5H27" stroke="$I" stroke-width="1.5"/><circle cx="44.5" cy="30.5" r="7.5" ${s(2.5)}/><path d="M28 30.5H36" ${s(2.5)} stroke-dasharray="2 3"/>`,
  polyglot: `<path d="M14 18H38V33H25L19 39V33H14Z" fill="$I"/><path d="M28 29H50V44H45V50L39 44H28Z" fill="$I" fill-opacity=".65"/>`,

  'odd-pate': `<rect x="16" y="24" width="32" height="18" rx="3" fill="$I"/><path d="M16 28.5H48" stroke="$D" stroke-width="1.2"/><circle cx="24" cy="33" r="2" fill="$D"/><circle cx="33" cy="37" r="2" fill="$D"/><circle cx="41" cy="32" r="2" fill="$D"/>`,
  'odd-eclair': `<rect x="13" y="26" width="38" height="13" rx="6.5" fill="$I"/><path d="M17.5 28.5H46.5" stroke="$D" stroke-width="3" stroke-linecap="round"/>`,
  'odd-crumble': `<path d="M15 33H49C49 42 41 48 32 48S15 42 15 33Z" fill="$I"/><circle cx="21" cy="29" r="2.6" fill="$I"/><circle cx="28" cy="26.5" r="3" fill="$I"/><circle cx="35" cy="28.5" r="2.4" fill="$I"/><circle cx="42" cy="27" r="2.8" fill="$I"/>`,
  'odd-tart': `<circle cx="32" cy="32" r="15" fill="$I" stroke="$I" stroke-width="3.5" stroke-dasharray="3 2"/><circle cx="32" cy="32" r="10" fill="$D"/>`,
  'odd-souffle': `<path d="M19 34H45V46H19Z" fill="$I"/><path d="M19 38H45M19 42H45" stroke="$D" stroke-width="1.2"/><path d="M20 34C18 24 26 18 32 21C38 18 46 24 44 34Z" fill="$I"/>`,
  'odd-scone': `<path d="M17 44L32 19L47 44Z" fill="$I" stroke="$I" stroke-width="4" stroke-linejoin="round"/><circle cx="29" cy="36" r="2" fill="$D"/><circle cx="36" cy="33" r="1.8" fill="$D"/><circle cx="33" cy="40" r="1.8" fill="$D"/>`,
  'odd-nougat': `<rect x="17" y="21" width="30" height="22" rx="2.5" fill="$I"/><ellipse cx="25" cy="28" rx="3" ry="2" fill="$D"/><ellipse cx="38" cy="31" rx="3" ry="2" fill="$D"/><ellipse cx="28" cy="37" rx="3" ry="2" fill="$D"/>`,
  'odd-parfait': `<path d="M22 16H42L39 44H25Z" fill="$I"/><path d="M23 25H41M24 34H40" stroke="$D" stroke-width="2.5"/><path d="M32 44V49M26 49H38" ${s(2.5)}/>`,
  'odd-crepe': `<path d="M14 22H50L32 46Z" fill="$I"/><path d="M14 22L36 30L50 22" fill="none" stroke="$D" stroke-width="1.6" stroke-linejoin="round"/>`,
  'odd-macaron': `<ellipse cx="32" cy="25" rx="15" ry="6.5" fill="$I"/><rect x="18.5" y="29" width="27" height="5" rx="2" fill="$D"/><ellipse cx="32" cy="38.5" rx="15" ry="6.5" fill="$I"/>`,
  'odd-crumpet': `<circle cx="32" cy="32" r="15" fill="$I"/><circle cx="26" cy="27" r="2" fill="$D"/><circle cx="35" cy="25" r="1.6" fill="$D"/><circle cx="38" cy="34" r="2" fill="$D"/><circle cx="29" cy="37" r="1.7" fill="$D"/><circle cx="32" cy="31" r="1.3" fill="$D"/>`,
  'odd-lokum': `<rect x="16" y="30" width="14" height="14" rx="2" fill="$I"/><rect x="34" y="30" width="14" height="14" rx="2" fill="$I"/><rect x="25" y="16" width="14" height="14" rx="2" fill="$I"/><path d="M18 33H28M36 33H46M27 19H37" stroke="$D" stroke-width="1.2" stroke-dasharray="1 2"/>`,

  ember: `<path d="M32 14C38 22 44 27 44 36C44 43 38 48 32 48S20 43 20 36C20 29 26 26 27 19C30 23 30 27 32 28C33 24 33 19 32 14Z" fill="$I"/><path d="M32 34C35 37 36 39 36 42C36 44.5 34 46 32 46S28 44.5 28 42C28 39 30 37 32 34Z" fill="$D"/>`,
  'three-coals': `<circle cx="22" cy="42" r="6" fill="$I"/><circle cx="32" cy="43.5" r="6" fill="$I"/><circle cx="42" cy="42" r="6" fill="$I"/><path d="M32 15C36 21 39 24 39 29C39 33 36 36 32 36S25 33 25 29C25 25 28 23 29 19C30 21 31 23 32 23C33 21 33 18 32 15Z" fill="$I"/>`,
  'steady-flame': `<rect x="26" y="31" width="12" height="17" rx="1.5" fill="$I"/><path d="M32 31V28" stroke="$D" stroke-width="1.5"/><path d="M32 14C35 18 37 21 37 24C37 27 35 28.5 32 28.5S27 27 27 24C27 21 29 18 32 14Z" fill="$I"/>`,
  'banked-fire': `<path d="M17 46L47 39M17 39L47 46" ${s(5)}/><path d="M32 14C37 20 41 24 41 30C41 35 37 38 32 38S23 35 23 30C23 25 27 22 28 18C30 21 31 23 32 24C33 21 33 18 32 14Z" fill="$I"/>`,
}

/** Escapes text for SVG markup. */
export const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** A colour `amount` (0-1) of the way to black. */
export function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1]!, 16)
  const ch = (v: number): string => Math.round(v * (1 - amount)).toString(16).padStart(2, '0')
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`
}

function paint(glyph: string, ink: string, dark: string, isEarned: boolean): string {
  return glyph
    .replaceAll('$I', ink)
    .replaceAll('$D', dark)
    .replaceAll('$R', isEarned ? RED : GREY_INK)
    .replaceAll('$G', isEarned ? GREEN : GREY_EDGE)
}

/**
 * One pin in a 64 x 64 box, as a fragment to place: full enamel when earned, a grey silhouette
 * of the same paths when locked, a grey blank with "?" when hidden.
 */
export function pinMarkup(id: string, frame: Frame, enamel: string, look: PinLook): string {
  const f = FRAMES[frame]
  const glyph = GLYPHS[id] ?? ''
  if (look === 'earned') {
    const dark = shade(enamel, 0.35)
    return (
      `<path d="${f.outer}" fill="${RIM}" stroke="${RIM_EDGE}" stroke-width="1.5"/>` +
      `<path d="${f.inner}" fill="${enamel}" stroke="${dark}"/>` +
      `<path d="${f.shine}" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="2.5" stroke-linecap="round"/>` +
      paint(glyph, INK, dark, true)
    )
  }
  const blank = `<path d="${f.outer}" fill="${GREY_RIM}" stroke="${GREY_EDGE}" stroke-width="1.5"/><path d="${f.inner}" fill="${GREY_FILL}"/>`
  if (look === 'hidden') {
    return blank + `<text x="32" y="41" text-anchor="middle" font-family="${SERIF}" font-size="24" font-weight="700" fill="${GREY_INK}">?</text>`
  }
  return blank + paint(glyph, GREY_INK, GREY_EDGE, false)
}

/** One pin as a whole document, 64 px (for previews and single-pin spots). */
export function pinSvg(id: string, frame: Frame, enamel: string, look: PinLook, title: string): string {
  return `<svg ${NS} width="64" height="64" viewBox="0 0 64 64"><title>${esc(title)}</title>${pinMarkup(id, frame, enamel, look)}</svg>`
}

/** One place on a page of the book: the pin, its name, one or two small lines, a tooltip. */
export type Cell = { pin: string; name: string; lines: readonly string[]; tip: string }

export const CELL_W = 96
export const CELL_H = 116

/** A page of the book: a parchment card of pins, `cols` across, with names and dates beneath. */
export function pageSvg(cells: readonly Cell[], cols: number, title: string): string {
  const across = Math.max(1, Math.min(cols, cells.length))
  const rows = Math.max(1, Math.ceil(cells.length / across))
  const w = across * CELL_W + 16
  const h = rows * CELL_H + 12
  let out =
    `<svg ${NS} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${esc(title)}</title>` +
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="10" fill="${PAGE}" stroke="${PAGE_EDGE}" stroke-width="1.5"/>`
  cells.forEach((cell, i) => {
    const x = 8 + (i % across) * CELL_W
    const y = 6 + Math.floor(i / across) * CELL_H
    const size = cell.name.length > 14 ? 9.5 : 11
    out +=
      `<g transform="translate(${x} ${y})"><title>${esc(cell.tip)}</title>` +
      `<g transform="translate(16 2)">${cell.pin}</g>` +
      `<text x="48" y="81" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="600" fill="${TEXT}">${esc(cell.name)}</text>` +
      cell.lines
        .slice(0, 2)
        .map((line, j) => `<text x="48" y="${95 + j * 11}" text-anchor="middle" font-family="${FONT}" font-size="9" fill="${SUBTLE}">${esc(line)}</text>`)
        .join('') +
      `</g>`
  })
  return out + '</svg>'
}

const DROP = 'keyTimes="0;0.55;0.75;1" keySplines="0.55 0 1 0.45;0 0.55 0.45 1;0.55 0 1 0.45" calcMode="spline" dur="0.9s"'

/** The drop's size in CSS pixels, for the Svg element that shows it. */
export const DROP_H = 60
export const dropWidth = (pins: number): number => pins * 54 + 4

/**
 * Pins dropping into the band: each falls from above, bounces once and stays (SMIL, so the Svg is
 * drawn interactive). Its resting place is where it lands, so a frame that runs no SMIL still shows
 * the pins. `pins` are pinMarkup fragments, at most three.
 */
export function dropSvg(pins: readonly string[]): string {
  const w = dropWidth(pins.length)
  let out = `<svg ${NS} width="${w}" height="${DROP_H}" viewBox="0 0 ${w} ${DROP_H}">`
  pins.forEach((pin, i) => {
    out +=
      `<g transform="translate(${2 + i * 54} 0)">` +
      `<ellipse cx="25" cy="55" rx="14" ry="2.6" fill="#000000" fill-opacity="0.2">` +
      `<animate attributeName="rx" values="3;16;11;14" ${DROP} fill="freeze"/></ellipse>` +
      `<g><animateTransform attributeName="transform" type="translate" values="0 -60;0 0;0 -8;0 0" ${DROP} fill="freeze"/>` +
      `<g transform="translate(1 1) scale(0.75)">${pin}</g></g></g>`
  })
  return out + '</svg>'
}

/** The plaque's size in CSS pixels. */
export const PLAQUE_W = 232
export const PLAQUE_H = 44

/** A brass plaque for a new workshop title, a shine sweeping across it once. */
export function plaqueSvg(title: string): string {
  return (
    `<svg ${NS} width="${PLAQUE_W}" height="${PLAQUE_H}" viewBox="0 0 ${PLAQUE_W} ${PLAQUE_H}">` +
    `<rect x="1" y="3" width="230" height="38" rx="6" fill="#b48a35" stroke="#6f531a" stroke-width="1.5"/>` +
    `<rect x="6.5" y="8.5" width="219" height="27" rx="3" fill="none" stroke="#e3c77e"/>` +
    `<circle cx="13" cy="22" r="2.4" fill="#e3c77e" stroke="#6f531a" stroke-width=".8"/>` +
    `<circle cx="219" cy="22" r="2.4" fill="#e3c77e" stroke="#6f531a" stroke-width=".8"/>` +
    `<text x="116" y="17.5" text-anchor="middle" font-family="${FONT}" font-size="8" font-weight="700" letter-spacing="1.6" fill="#3a2808">NEW TITLE</text>` +
    `<text x="116" y="31.5" text-anchor="middle" font-family="${SERIF}" font-size="14" font-weight="700" fill="#2e2108">${esc(title)}</text>` +
    `<path d="M24 9H34L26 35H16Z" fill="#fff8e0" fill-opacity="0">` +
    `<animate attributeName="fill-opacity" values="0;0.55;0" dur="1.4s" begin="0.5s" fill="freeze"/>` +
    `<animateTransform attributeName="transform" type="translate" values="0 0;184 0" dur="1.4s" begin="0.5s" fill="freeze"/></path>` +
    `</svg>`
  )
}
