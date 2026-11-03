// field-badges: the catalog. Chapters, badges and the ladder of workshop titles: pure data, no
// imports, so the art preview can read it too. Every name here is original to this mod.

export type ChapterId = 'git' | 'tests' | 'workflows' | 'endurance' | 'crew' | 'craft' | 'oddities' | 'kindled'
export type Frame = 'round' | 'shield' | 'hex'

/** A chapter of the book: its pin frame and enamel colour (mid-tones that read on light and dark). */
export type Chapter = { id: ChapterId; name: string; frame: Frame; enamel: string }

/**
 * One badge. `short` fits under a 64 px pin; `hint` is what a locked pin says (two short lines at
 * most); a `hidden` badge shows only "?" until earned, unless the hiddenHints option is on.
 */
export type Badge = { id: string; name: string; short: string; chapter: ChapterId; hint: string; hidden?: true }

export const CHAPTERS: readonly Chapter[] = [
  { id: 'git', name: 'Git', frame: 'round', enamel: '#4a78b5' },
  { id: 'tests', name: 'Tests', frame: 'shield', enamel: '#4b9a62' },
  { id: 'workflows', name: 'Workflows', frame: 'hex', enamel: '#348f94' },
  { id: 'endurance', name: 'Endurance', frame: 'round', enamel: '#bf7a2e' },
  { id: 'crew', name: 'Crew', frame: 'shield', enamel: '#8762b3' },
  { id: 'craft', name: 'Craft', frame: 'hex', enamel: '#b5564c' },
  { id: 'oddities', name: 'Oddities', frame: 'round', enamel: '#a8648a' },
  { id: 'kindled', name: 'Kindled Days', frame: 'shield', enamel: '#c8642a' },
]

const b = (chapter: ChapterId, id: string, name: string, hint: string, extra: { short?: string; hidden?: true } = {}): Badge => ({
  id,
  name,
  short: extra.short ?? name,
  chapter,
  hint,
  ...(extra.hidden ? { hidden: true as const } : {}),
})

export const BADGES: readonly Badge[] = [
  b('git', 'first-stitch', 'First Stitch', 'Your first commit'),
  b('git', 'sent-off', 'Sent Off', 'A push goes out'),
  b('git', 'ribbon-cut', 'Ribbon Cut', 'Open a pull request'),
  b('git', 'bridge-builder', 'Bridge Builder', 'A pull request is merged'),
  b('git', 'untangler', 'Untangler', 'A rebase goes through'),
  b('git', 'knot-tied', 'Knot Tied', 'A branch merge goes through'),
  b('git', 'second-draft', 'Second Draft', 'Amend a commit'),
  b('git', 'cherry-picker', 'Cherry Picker', 'Carry one commit across', { hidden: true }),

  b('tests', 'first-light', 'First Light', 'A test run passes'),
  b('tests', 'red-to-green', 'Red to Green', 'Tests pass within 15 min of failing'),
  b('tests', 'true-square', 'True Square', 'Type check clean after failing'),
  b('tests', 'smooth-plane', 'Smooth Plane', 'Lint clean after failing'),
  b('tests', 'fresh-gauge', 'Fresh Gauge', 'Write a new test file'),

  b('workflows', 'shipwright', 'Shipwright', 'Launch a workflow'),
  b('workflows', 'fleet-return', 'Fleet Return', 'A workflow run finishes'),
  b('workflows', 'long-voyage', 'Long Voyage', 'A workflow of 30+ min finishes', { hidden: true }),
  b('workflows', 'hands-free', 'Hands Free', 'A background command finishes'),

  b('endurance', 'clocked-in', 'Clocked In', 'First answer of a workday'),
  b('endurance', 'long-haul', 'Long Haul', 'A 30-minute turn ends in an answer'),
  b('endurance', 'second-wind', 'Second Wind', 'An answer after a compaction', { hidden: true }),
  b('endurance', 'clean-sweep', 'Clean Sweep', 'A to-do list of 8+, all done'),

  b('crew', 'first-mate', 'First Mate', 'Send out a helper agent'),
  b('crew', 'lookout', 'Lookout', 'Send out an Explore agent'),
  b('crew', 'conductor', 'Conductor', 'Five helpers in one turn'),

  b('craft', 'blank-page', 'Blank Page', 'Create a new file'),
  b('craft', 'lean-cut', 'Lean Cut', 'An edit nets 100 lines out'),
  b('craft', 'bridgewalker', 'Bridgewalker', 'Windows and WSL paths in one turn', { hidden: true }),
  b('craft', 'polyglot', 'Polyglot', 'Four languages edited in one turn', { hidden: true }),

  b('oddities', 'odd-pate', 'Permission Denied Pâté', 'An error flavour', { short: 'Denied Pâté', hidden: true }),
  b('oddities', 'odd-eclair', 'ENOENT Éclair', 'An error flavour', { hidden: true }),
  b('oddities', 'odd-crumble', 'Merge-Conflict Crumble', 'An error flavour', { short: 'Conflict Crumble', hidden: true }),
  b('oddities', 'odd-tart', 'Timeout Tart', 'An error flavour', { hidden: true }),
  b('oddities', 'odd-souffle', 'Segfault Soufflé', 'An error flavour', { hidden: true }),
  b('oddities', 'odd-scone', 'Syntax Error Scone', 'An error flavour', { short: 'Syntax Scone', hidden: true }),
  b('oddities', 'odd-nougat', 'Null Pointer Nougat', 'An error flavour', { short: 'Null Nougat', hidden: true }),
  b('oddities', 'odd-parfait', 'Port-in-Use Parfait', 'An error flavour', { short: 'Port Parfait', hidden: true }),
  b('oddities', 'odd-crepe', 'Command-Not-Found Crêpe', 'An error flavour', { short: 'Not-Found Crêpe', hidden: true }),
  b('oddities', 'odd-macaron', 'Missing Module Macaron', 'An error flavour', { short: 'Module Macaron', hidden: true }),
  b('oddities', 'odd-crumpet', 'Connection Refused Crumpet', 'An error flavour', { short: 'Refused Crumpet', hidden: true }),
  b('oddities', 'odd-lokum', 'Lockfile Lokum', 'An error flavour', { hidden: true }),

  b('kindled', 'ember', 'First Ember', 'A day something shipped'),
  b('kindled', 'three-coals', 'Three Coals', 'Three kindled workdays running'),
  b('kindled', 'steady-flame', 'Steady Flame', 'Five kindled workdays running'),
  b('kindled', 'banked-fire', 'Banked Fire', 'Twenty kindled days in all'),
]

export const BY_ID: ReadonlyMap<string, Badge> = new Map(BADGES.map(x => [x.id, x]))
export const CHAPTER_BY_ID: ReadonlyMap<ChapterId, Chapter> = new Map(CHAPTERS.map(c => [c.id, c]))

/** The workshop titles, each reached at a number of badges earned. */
export const TITLES: readonly { name: string; at: number }[] = [
  { name: 'Apprentice', at: 1 },
  { name: 'Tinkerer', at: 3 },
  { name: 'Wrenchhand', at: 5 },
  { name: 'Fitter', at: 8 },
  { name: 'Journeyer', at: 11 },
  { name: 'Lathe-wise', at: 14 },
  { name: 'Joiner', at: 17 },
  { name: 'Artificer', at: 21 },
  { name: 'Draftmaster', at: 25 },
  { name: 'Keystone', at: 30 },
  { name: 'Master of Small Things', at: 35 },
  { name: 'Old Hand', at: 40 },
]

/** The index in TITLES of the title `count` badges have reached; -1 before the first. */
export function titleIndex(count: number): number {
  let at = -1
  TITLES.forEach((t, i) => {
    if (count >= t.at) at = i
  })
  return at
}
