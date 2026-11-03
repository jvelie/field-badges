// field-badges: forty-four pin badges for memorable moments of real work, each earned once ever and
// kept in a badge book beside the chat, with a ladder of workshop titles. Looks only: every hook
// here observes and hands on exactly what it was given; nothing reaches the model (no context, no
// prompt section, no rewritten or refused call, no command reply text).
//  - Observers: tool.call (shell, edits, to-dos, workflows, reads), agent.spawn, turn.start and
//    turn.complete (main loop), session.compact and prompt.submit (task notifications). Each awaits
//    next(e), then reads what happened on a 1 ms timer, so no result waits on a badge.
//  - Drawing, desktop: a pin drop and a title plaque in the band above the prompt for a few seconds
//    after an unlock, a small pressable badge icon at the right end of the prompt footer, and the book in
//    a pane opened from that icon or /badges. The terminal gets a `◆ n` footer label and a text book;
//    the band is left to the engine there.
//  - Persistence: one $.store key per badge and per kindled day (two sessions never overwrite each
//    other's), mirrored into $.state for drawing.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'
import type { FieldBadgesEarned, FieldBadgesFlash, FieldBadgesKindled } from '../types'
import { DROP_H, PLAQUE_H, PLAQUE_W, dropSvg, dropWidth, pageSvg, pinMarkup, plaqueSvg, type Cell } from './art'
import { BADGES, BY_ID, CHAPTER_BY_ID, CHAPTERS, TITLES, titleIndex, type Badge, type Chapter } from './badges'
import * as d from './detect'

const PANE = 'badge-book'
const PANE_TITLE = 'Badge book'
const ICON = 'badge-book'
const TOAST_GAP_MS = 300_000
const TOAST_MERGE_MS = 1_500
const TOAST_SHOW_MS = 5_000
const DROP_MS = 5_000
const PLAQUE_MS = 8_000
const RED_GREEN_MS = 900_000
const CLEAN_AGAIN_MS = 3_600_000
const LONG_TURN_MS = 1_800_000
const LONG_RUN_MS = 1_800_000
const STALE_RUN_MS = 7 * 86_400_000
const CONDUCTOR_AT = 5
const POLYGLOT_AT = 4
const LEAN_CUT_AT = 100

const EARNED = atom({ plugin: 'field-badges', key: 'earned' } as const, {})
const FLASH = atom({ plugin: 'field-badges', key: 'flash' } as const, null)
const HUSH = atom({ plugin: 'field-badges', key: 'hush' } as const, false)
const KINDLED = atom({ plugin: 'field-badges', key: 'kindled' } as const, { count: 0, best: 0 })

type Earned = Record<string, FieldBadgesEarned>
type Loose = Record<string, unknown>
type Ran = { deny?: string; isError?: boolean; result?: unknown; text?: string }
type Timer = ReturnType<EngineInterface['clock']['after']>

type Opts = {
  isOn: boolean
  toasts: boolean
  pinDrops: boolean
  footerButton: boolean
  footerIcon: string
  footerLabel: boolean
  command: boolean
  hiddenHints: boolean
  oddities: boolean
  kindledDays: boolean
  quiet: boolean
  workdays: ReadonlySet<number>
  offset: d.Offset
}

function readOptions(o: PluginOptions): Opts {
  const isSet = (key: string): boolean => o[key] !== false
  return {
    isOn: isSet('badges'),
    toasts: isSet('toasts'),
    pinDrops: isSet('pinDrops'),
    // `bookButton` (the old band button) is gone: a stored value is accepted and ignored
    footerButton: isSet('footerButton'),
    footerIcon: typeof o.footerIcon === 'string' && o.footerIcon.trim() !== '' ? o.footerIcon.trim() : '🏅',
    footerLabel: isSet('footerLabel'),
    command: isSet('command'),
    hiddenHints: o.hiddenHints === true,
    oddities: isSet('oddities'),
    kindledDays: isSet('kindledDays'),
    quiet: o.quiet === true,
    workdays: d.parseWorkdays(o.workdays),
    offset: d.parseOffset(o.utcOffset),
  }
}

// ---- this module instance's memory (a hot reload starts it afresh; $.state and $.store keep the rest)

type Turn = { spawns: number; win: boolean; wsl: boolean; langs: Set<string> }
const freshTurn = (): Turn => ({ spawns: 0, win: false, wsl: false, langs: new Set() })

let opts: Opts = readOptions({})
let loading: Promise<void> | undefined
let cwd: string | undefined
let turn = freshTurn()
let compacted = false
let commandAsked = false
const failedAt = new Map<d.CheckKind, number>()
const bgTasks = new Set<string>()
let days = new Set<string>()
const claiming = new Set<string>()
let pending: string[] = []
let toastTimer: Timer | undefined
let flashTimer: Timer | undefined
const svgCache = new Map<string, string>()
let lastCols = 0

const isObj = (x: unknown): x is Loose => typeof x === 'object' && x !== null && !Array.isArray(x)
const str = (x: unknown): string => (typeof x === 'string' ? x : '')
const num = (x: unknown, fallback: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : fallback)
const clip = (text: string, n: number): string => (text.length > n ? text.slice(0, n - 1) + '…' : text)
const tail = (text: string, n: number): string => (text.length > n ? text.slice(-n) : text)

const chapterOn = (chapter: string): boolean =>
  (chapter !== 'oddities' || opts.oddities) && (chapter !== 'kindled' || opts.kindledDays)
const shownChapters = (): Chapter[] => CHAPTERS.filter(c => chapterOn(c.id))
const shownBadges = (): Badge[] => BADGES.filter(b => chapterOn(b.chapter))
const badgesOf = (chapter: Chapter): Badge[] => BADGES.filter(b => b.chapter === chapter.id)
const countOf = (earned: Earned): number => shownBadges().reduce((n, b) => n + (earned[b.id] ? 1 : 0), 0)

function earnedOf(x: unknown): FieldBadgesEarned | undefined {
  if (!isObj(x) || typeof x.at !== 'number') return undefined
  return { at: x.at, where: str(x.where), detail: str(x.detail) }
}

/** Follow-up work on a timer, so the call, the turn or the prompt it came from never waits on it. */
function later($: EngineInterface, work: () => Promise<unknown>): void {
  try {
    $.clock.after(1, () => {
      work().catch(() => undefined)
    })
  } catch {
    // a badge never matters more than the work
  }
}

// ---- loading ---------------------------------------------------------------------------------

function loaded($: EngineInterface): Promise<void> {
  loading ??= load($).catch(() => undefined)
  return loading
}

async function load($: EngineInterface): Promise<void> {
  const keys = await $.store.keys()
  const now = await $.clock.now()
  const fromStore: Earned = {}
  const stale: string[] = []
  await Promise.all(
    keys.map(async key => {
      if (key.startsWith('badge:')) {
        const rec = earnedOf(await $.store.get(key))
        if (rec && BY_ID.has(key.slice(6))) fromStore[key.slice(6)] = rec
      } else if (key.startsWith('wf:')) {
        const run = await $.store.get(key)
        if (!isObj(run) || now - num(run.at, 0) > STALE_RUN_MS) stale.push(key)
      }
    }),
  )
  for (const key of stale) await $.store.delete(key)
  days = new Set([...days, ...keys.filter(k => k.startsWith('kindled:')).map(k => k.slice(8))])
  const isHushed = (await $.store.get('hush')) === true
  const all = await update($, EARNED, held => ({ ...fromStore, ...held }))
  await update($, HUSH, () => isHushed)
  await update($, KINDLED, () => kindledSum())
  // the pane's width is known only once drawn: guess a docked pane's until then
  warmBook(all, lastCols || 4)
}

const kindledSum = (): FieldBadgesKindled => ({ count: days.size, best: d.bestRun(days, opts.workdays) })

async function ensureCommand($: EngineInterface): Promise<void> {
  if (!opts.command || commandAsked) return
  commandAsked = true
  try {
    await $.command.register({ name: 'badges', description: 'Open the badge book beside the chat' })
  } catch {
    commandAsked = false
  }
}

async function whereName($: EngineInterface): Promise<string> {
  if (cwd === undefined) {
    try {
      cwd = await $.session.cwd()
    } catch {
      cwd = ''
    }
  }
  return d.baseName(cwd)
}

// ---- earning ---------------------------------------------------------------------------------

/** Earns a badge once ever: stored, drawn, celebrated. False when it was already earned. */
async function unlock($: EngineInterface, id: string, detail: string): Promise<boolean> {
  const badge = BY_ID.get(id)
  if (!badge || !chapterOn(badge.chapter) || claiming.has(id)) return false
  claiming.add(id)
  try {
    await loaded($)
    if ((await read($, EARNED))[id]) return false
    const stored = earnedOf(await $.store.get(`badge:${id}`))
    if (stored) {
      // another session earned it since this one loaded: take it in, quietly
      await update($, EARNED, held => ({ ...held, [id]: stored }))
      return false
    }
    const rec: FieldBadgesEarned = { at: await $.clock.now(), where: await whereName($), detail: clip(detail, 120) }
    await $.store.set(`badge:${id}`, rec)
    const all = await update($, EARNED, held => ({ ...held, [id]: rec }))
    warmBook(all)
    await celebrate($, badge, countOf(all))
    return true
  } finally {
    claiming.delete(id)
  }
}

const isQuiet = async ($: EngineInterface): Promise<boolean> => opts.quiet || (await read($, HUSH))

async function celebrate($: EngineInterface, badge: Badge, count: number): Promise<void> {
  if (await isQuiet($)) return
  if (opts.toasts) queueToast($, badge.name)
  if (opts.pinDrops) {
    await showFlash($, f => ({ pins: [...f.pins.filter(p => p !== badge.id), badge.id].slice(-3), title: f.title }), DROP_MS)
    await maybePlaque($, count)
  }
}

/** Shows a new title's plaque, at most once a day; a title reached later that day waits for the next. */
async function maybePlaque($: EngineInterface, count: number): Promise<void> {
  const idx = titleIndex(count)
  if (idx < 0) return
  if (idx <= num(await $.store.get('title:announced'), -1)) return
  const today = d.dayKey(await $.clock.now(), opts.offset)
  if ((await $.store.get('plaque:day')) === today) return
  await $.store.set('plaque:day', today)
  await $.store.set('title:announced', idx)
  await showFlash($, f => ({ pins: f.pins, title: TITLES[idx]!.name }), PLAQUE_MS)
}

type Shown = { pins: string[]; title: string }

async function showFlash($: EngineInterface, change: (now: Shown) => Shown, ms: number): Promise<void> {
  const now = await $.clock.now()
  const next = await update($, FLASH, (f): FieldBadgesFlash => {
    const live = f !== null && f.until > now ? f : { pins: [], title: '', until: now }
    const c = change(live)
    return { pins: c.pins, title: c.title, until: Math.max(live.until, now + ms) }
  })
  if (next) {
    if (next.pins.length) dropFor(next.pins)
    if (next.title) plaqueFor(next.title)
    endFlashIn($, next.until - now)
  }
}

function endFlashIn($: EngineInterface, ms: number): void {
  flashTimer?.cancel()
  try {
    flashTimer = $.clock.after(Math.max(1, ms), () => {
      flashTimer = undefined
      endFlash($).catch(() => undefined)
    })
  } catch {
    flashTimer = undefined
  }
}

async function endFlash($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const left = await update($, FLASH, f => (f !== null && f.until <= now ? null : f))
  if (left) endFlashIn($, left.until - now)
}

function queueToast($: EngineInterface, name: string): void {
  pending.push(name)
  if (!toastTimer) armToast($, TOAST_MERGE_MS)
}

function armToast($: EngineInterface, ms: number): void {
  try {
    toastTimer = $.clock.after(Math.max(1, ms), () => {
      toastTimer = undefined
      flushToasts($).catch(() => undefined)
    })
  } catch {
    toastTimer = undefined
  }
}

/** One toast for what unlocked together, at most one every 5 minutes (across sessions). */
async function flushToasts($: EngineInterface): Promise<void> {
  if (pending.length === 0) return
  if (!opts.toasts || (await isQuiet($))) {
    pending = []
    return
  }
  const now = await $.clock.now()
  const wait = Math.min(num(await $.store.get('toast:last'), 0) + TOAST_GAP_MS - now, TOAST_GAP_MS)
  if (wait > 0) {
    armToast($, wait)
    return
  }
  const names = pending
  pending = []
  await $.store.set('toast:last', now)
  $.ui.toast(d.toastText(names), { timeoutMs: TOAST_SHOW_MS })
}

async function kindle($: EngineInterface, what: string): Promise<void> {
  if (!opts.kindledDays) return
  await loaded($)
  const now = await $.clock.now()
  const day = d.dayKey(now, opts.offset)
  if (days.has(day)) return
  days.add(day)
  await $.store.set(`kindled:${day}`, 1)
  const sum = kindledSum()
  await update($, KINDLED, () => sum)
  await unlock($, 'ember', `${d.shortDay(now, opts.offset)}: ${what}`)
  if (sum.best >= 3) await unlock($, 'three-coals', `${sum.best} kindled workdays running`)
  if (sum.best >= 5) await unlock($, 'steady-flame', `${sum.best} kindled workdays running`)
  if (sum.count >= 20) await unlock($, 'banked-fire', `${sum.count} kindled days`)
}

// ---- reading what happened -------------------------------------------------------------------

/** A refusal at the permission card, an interrupt or a hook's block: it ran nothing. */
function isRefused(errText: string, isShell: boolean): boolean {
  const head = errText.slice(0, 400)
  if (!/^\s*Exit code\s+\d/i.test(head) && d.isRefusal(head)) return true
  // a failed shell call's text starts with its exit code; one without ran to no verdict
  return isShell && !d.EXIT_RE.test(errText.slice(0, 300))
}

async function onTool($: EngineInterface, e: Loose, ran: Ran): Promise<void> {
  if (ran.deny !== undefined) return
  const tool = str(e.tool)
  const isMain = e.agentId === undefined
  const isError = ran.isError === true
  // the head and the tail: a long run's own error is usually its last line
  const errText = isError ? d.headTail(str(ran.text) || str(ran.result), 1500) : ''
  const rec = !isError && isObj(ran.result) ? ran.result : undefined
  const isShell = tool === 'Bash' || tool === 'PowerShell'
  if (isError && isRefused(errText, isShell)) return
  if (isMain) await crossings($, e)
  if (isError) await oddity($, tool, errText)
  if (isShell) await shell($, str(e.command), isError, errText, rec)
  else if (rec && (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit')) await edited($, tool, e, rec, isMain)
  else if (rec && tool === 'TodoWrite') await todos($, e, rec)
  else if (rec && tool === 'Workflow') await launched($, rec)
}

async function crossings($: EngineInterface, e: Loose): Promise<void> {
  const text = [e.command, e.file_path, e.notebook_path, e.path].map(str).join('\n')
  if (!text.trim()) return
  const side = d.sides(text)
  turn.win ||= side.win
  turn.wsl ||= side.wsl
  if (turn.win && turn.wsl) await unlock($, 'bridgewalker', 'Windows and WSL paths in one turn')
}

async function oddity($: EngineInterface, tool: string, errText: string): Promise<void> {
  if (!opts.oddities) return
  const hit = d.oddityOf(errText)
  if (hit) await unlock($, hit.id, `${hit.match}, in ${tool}`)
}

async function shell($: EngineInterface, command: string, isError: boolean, errText: string, rec: Loose | undefined): Promise<void> {
  const out = rec ? `${str(rec.stdout)}\n${str(rec.stderr)}` : ''
  if (rec) {
    // the engine's own record, else git's own lines (a git run wrapped in another shell goes unclassified)
    const git = isObj(rec.gitOperation) ? rec.gitOperation : d.gitFromOutput(command, d.headTail(out, 3000))
    if (git) await gitOps($, git as Loose)
    if (str(rec.backgroundTaskId)) bgTasks.add(str(rec.backgroundTaskId))
  }
  const check = d.classifyCheck(command)
  if (!check) return
  const verdict = d.verdict(check.kind, {
    isError,
    errText,
    out: tail(out, 4000),
    interrupted: rec?.interrupted === true,
    backgrounded: rec !== undefined && (rec.backgroundTaskId !== undefined || rec.timedOutAfterMs !== undefined),
  })
  if (verdict) await checked($, check, verdict)
}

async function gitOps($: EngineInterface, git: Loose): Promise<void> {
  const commit = isObj(git.commit) ? git.commit : undefined
  if (commit) {
    const sha = str(commit.sha).slice(0, 7)
    const on = str(commit.branch) ? ` on ${str(commit.branch)}` : ''
    if (commit.kind === 'committed') await unlock($, 'first-stitch', `commit ${sha}${on}`)
    else if (commit.kind === 'amended') await unlock($, 'second-draft', `amended ${sha}${on}`)
    else if (commit.kind === 'cherry-picked') await unlock($, 'cherry-picker', `cherry-picked ${sha}${on}`)
    await kindle($, `commit ${sha}`)
  }
  if (isObj(git.push)) {
    const branch = str(git.push.branch).replace(/^refs\/heads\//, '') || 'a branch'
    await unlock($, 'sent-off', `pushed ${branch}`)
    await kindle($, `push of ${branch}`)
  }
  if (isObj(git.branch)) {
    const ref = str(git.branch.ref) || 'a branch'
    if (git.branch.action === 'rebased') await unlock($, 'untangler', `rebase of ${ref} went through`)
    else if (git.branch.action === 'merged') await unlock($, 'knot-tied', `merged ${ref}`)
  }
  if (isObj(git.pr) && typeof git.pr.number === 'number') {
    const pr = `pull request #${git.pr.number}`
    if (git.pr.action === 'created') {
      await unlock($, 'ribbon-cut', `opened ${pr}`)
      await kindle($, `${pr} opened`)
    } else if (git.pr.action === 'merged') {
      await unlock($, 'bridge-builder', `${pr} merged`)
      await kindle($, `${pr} merged`)
    }
  }
}

async function checked($: EngineInterface, check: d.Check, verdict: 'pass' | 'fail'): Promise<void> {
  const now = await $.clock.now()
  if (verdict === 'fail') {
    failedAt.set(check.kind, now)
    return
  }
  const failed = failedAt.get(check.kind)
  failedAt.delete(check.kind)
  const since = failed === undefined ? Infinity : now - failed
  const mins = Math.max(1, Math.round(since / 60_000))
  if (check.kind === 'test') {
    await unlock($, 'first-light', `${check.label} passed`)
    if (since <= RED_GREEN_MS) await unlock($, 'red-to-green', `${check.label} went green ${mins} min after failing`)
  } else if (since <= CLEAN_AGAIN_MS) {
    await unlock($, check.kind === 'type' ? 'true-square' : 'smooth-plane', `${check.label} clean again after ${mins} min`)
  }
}

async function edited($: EngineInterface, tool: string, e: Loose, rec: Loose, isMain: boolean): Promise<void> {
  if (rec.staged === true) return // held for review: the file is unchanged
  const path = str(e.file_path) || str(e.notebook_path) || str(rec.filePath)
  const base = d.baseName(path)
  if (tool === 'Write' && rec.type === 'create') {
    await unlock($, 'blank-page', `created ${base}`)
    if (d.isTestFile(path)) await unlock($, 'fresh-gauge', `new test file ${base}`)
  }
  const net = d.netRemoved(rec)
  if (net >= LEAN_CUT_AT) await unlock($, 'lean-cut', `${base}: ${net} more lines out than in`)
  const lang = isMain ? d.languageOf(path) : undefined
  if (lang) {
    turn.langs.add(lang)
    if (turn.langs.size >= POLYGLOT_AT) await unlock($, 'polyglot', `${[...turn.langs].join(', ')} in one turn`)
  }
}

async function todos($: EngineInterface, e: Loose, rec: Loose): Promise<void> {
  const list: unknown[] = Array.isArray(e.todos) ? e.todos : []
  const old: unknown[] = Array.isArray(rec.oldTodos) ? rec.oldTodos : []
  const isDone = (t: unknown): boolean => isObj(t) && t.status === 'completed'
  if (list.length >= 8 && list.every(isDone) && old.some(t => !isDone(t))) {
    await unlock($, 'clean-sweep', `${list.length} to-dos, all done`)
  }
}

async function launched($: EngineInterface, rec: Loose): Promise<void> {
  // a script that failed its syntax check launched nothing
  if ((rec.status !== 'async_launched' && rec.status !== 'remote_launched') || str(rec.error)) return
  const name = str(rec.workflowName) || 'a workflow'
  await unlock($, 'shipwright', `launched ${name}`)
  const taskId = str(rec.taskId)
  if (taskId) await $.store.set(`wf:${taskId}`, { at: await $.clock.now(), name })
}

async function spawned($: EngineInterface, type: string, description: string): Promise<void> {
  turn.spawns += 1
  const n = turn.spawns
  await unlock($, 'first-mate', `${type}: ${clip(description, 60)}`)
  if (type === 'Explore') await unlock($, 'lookout', `Explore: ${clip(description, 60)}`)
  if (n >= CONDUCTOR_AT) await unlock($, 'conductor', `${n} helpers in one turn`)
}

async function notified($: EngineInterface, text: string): Promise<void> {
  for (const notice of d.parseNotifications(text)) {
    if (notice.status !== 'completed') continue
    const run = await $.store.get(`wf:${notice.taskId}`)
    if (isObj(run)) {
      await $.store.delete(`wf:${notice.taskId}`)
      const name = str(run.name) || 'a workflow'
      await unlock($, 'fleet-return', `${name} finished`)
      const took = (await $.clock.now()) - num(run.at, Infinity)
      if (took >= LONG_RUN_MS) await unlock($, 'long-voyage', `${name} finished after ${Math.round(took / 60_000)} min`)
    } else if (bgTasks.delete(notice.taskId)) {
      await unlock($, 'hands-free', 'a background command finished on its own')
    }
  }
}

async function mainTurnEnded($: EngineInterface, reason: string, durationMs: number): Promise<void> {
  await loaded($)
  await ensureCommand($)
  const now = await $.clock.now()
  if (reason === 'answer') {
    const p = d.parts(now, opts.offset)
    if (opts.workdays.has(p.wd)) await unlock($, 'clocked-in', `first answer of a ${d.WEEKDAYS[p.wd]}`)
    if (durationMs >= LONG_TURN_MS) await unlock($, 'long-haul', `a ${Math.round(durationMs / 60_000)}-minute turn ended with an answer`)
    if (compacted) {
      compacted = false
      await unlock($, 'second-wind', 'answered after the conversation was compacted')
    }
  }
  await dropStaleFlash($)
  // a title reached on a day whose plaque was already shown gets its plaque on a later day
  if (opts.pinDrops && !(await isQuiet($))) await maybePlaque($, countOf(await read($, EARNED)))
}

/** A hot reload drops timers: a flash the old module left up comes down at the next turn's start or end. */
async function dropStaleFlash($: EngineInterface): Promise<void> {
  const f = await read($, FLASH)
  if (f === null || flashTimer) return
  const now = await $.clock.now()
  if (f.until <= now) await update($, FLASH, held => (held !== null && held.until <= now ? null : held))
  else endFlashIn($, f.until - now)
}

async function toggleHush($: EngineInterface): Promise<void> {
  const isHushed = await update($, HUSH, h => !h)
  await $.store.set('hush', isHushed)
  if (isHushed) pending = []
}

async function openBook($: EngineInterface): Promise<void> {
  await $.ui.open({ id: PANE, title: PANE_TITLE })
}

// ---- the art, cached: built on events, only looked up while drawing ---------------------------

function cached(key: string, build: () => string): string {
  const hit = svgCache.get(key)
  if (hit !== undefined) return hit
  const svg = build()
  if (svgCache.size > 64) svgCache.clear()
  svgCache.set(key, svg)
  return svg
}

function earnedPin(id: string): string {
  const chapter = CHAPTER_BY_ID.get(BY_ID.get(id)?.chapter ?? 'git')!
  return pinMarkup(id, chapter.frame, chapter.enamel, 'earned')
}

const dropFor = (pins: readonly string[]): string => cached(`drop|${pins.join(',')}`, () => dropSvg(pins.map(earnedPin)))
const plaqueFor = (title: string): string => cached(`plaque|${title}`, () => plaqueSvg(title))

function cells(chapter: Chapter, earned: Earned): Cell[] {
  return badgesOf(chapter).map((b): Cell => {
    const got = earned[b.id]
    if (got) {
      const tip = `${b.name}: earned ${d.when(got.at, opts.offset)}`
      return { pin: pinMarkup(b.id, chapter.frame, chapter.enamel, 'earned'), name: b.short, lines: [d.shortDay(got.at, opts.offset)], tip }
    }
    if (b.hidden && !opts.hiddenHints) {
      return { pin: pinMarkup(b.id, chapter.frame, chapter.enamel, 'hidden'), name: '?', lines: ['hidden'], tip: 'A hidden badge' }
    }
    return { pin: pinMarkup(b.id, chapter.frame, chapter.enamel, 'locked'), name: b.short, lines: d.wrap2(b.hint, 19), tip: `${b.name}: ${b.hint}` }
  })
}

function pageFor(chapter: Chapter, earned: Earned, cols: number): string {
  const sig = badgesOf(chapter)
    .map(b => earned[b.id]?.at ?? 0)
    .join(',')
  return cached(`page|${chapter.id}|${cols}|${opts.hiddenHints ? 1 : 0}|${sig}`, () => pageSvg(cells(chapter, earned), cols, `${chapter.name} badges`))
}

/** Builds the book's pages ahead of a draw (at load, and after an unlock), so drawing only looks up. */
function warmBook(earned: Earned, cols = lastCols): void {
  if (cols > 0) for (const chapter of shownChapters()) pageFor(chapter, earned, cols)
}

const colsFor = (bodyColumns: number): number => Math.max(2, Math.min(8, Math.floor((bodyColumns * 8 - 16) / 96)))

function pageAlt(chapter: Chapter, earned: Earned): string {
  const list = badgesOf(chapter)
  const got = list.filter(b => earned[b.id]).map(b => b.name)
  return `${chapter.name}: ${got.length} of ${list.length} badges earned${got.length ? `: ${got.join(', ')}` : ''}.`
}

function heading(earned: Earned): { title: string; progress: string } {
  const n = countOf(earned)
  const idx = titleIndex(n)
  const total = shownBadges().length
  const next = TITLES[idx + 1]
  const title = idx >= 0 ? TITLES[idx]!.name : 'No title yet'
  const progress = next
    ? `${n} of ${total} badges · next title, ${next.name}, at ${next.at}`
    : `${n} of ${total} badges · top of the ladder`
  return { title, progress }
}

function stories(earned: Earned): string[] {
  return Object.entries(earned)
    .filter(([id]) => BY_ID.has(id) && chapterOn(BY_ID.get(id)!.chapter))
    .sort((a, b) => b[1].at - a[1].at)
    .map(([id, rec]) => `${d.when(rec.at, opts.offset)}  ${BY_ID.get(id)!.name}${rec.where ? `, in ${rec.where}` : ''}: ${rec.detail}`)
}

function textRow(chapter: Chapter, earned: Earned): string {
  const list = badgesOf(chapter)
  const got = list.filter(b => earned[b.id]).length
  const marks = list.map(b => (earned[b.id] ? `◆ ${b.short}` : b.hidden && !opts.hiddenHints ? '◇ ?' : `◇ ${b.short}`))
  return `${chapter.name} ${got}/${list.length}: ${marks.join('  ')}`
}

// ---- hooks -----------------------------------------------------------------------------------

export const register: Register = (on, options) => {
  opts = readOptions(options)
  if (!opts.isOn) return

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    if (e.cwd) cwd = e.cwd
    await ensureCommand($)
    later($, () => loaded($))
    return r
  }).catch(($, e, next) => next(e))

  on(
    'tool.call',
    { tool: ['Bash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit', 'TodoWrite', 'Workflow', 'Read', 'Grep', 'Glob'] },
    async ($, e, next) => {
      const ran = await next(e)
      // a subagent's read that went through can earn nothing: no timer for it
      const isQuietRead = (e.tool === 'Read' || e.tool === 'Grep' || e.tool === 'Glob') && e.agentId !== undefined && ran.isError !== true
      if (!isQuietRead) later($, () => onTool($, e as unknown as Loose, ran as unknown as Ran))
      return ran
    },
  ).catch(($, e, next) => next(e)) // fail open: next(e) replays a call that already ran

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.agentId !== undefined && e.parentAgentId === undefined && e.workflow === undefined && e.resume === undefined) {
      const { subagentType, description } = e
      later($, () => spawned($, subagentType, description))
    }
    return r
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) {
      turn = freshTurn()
      later($, () => dropStaleFlash($))
    }
    return r
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) {
      const { reason, durationMs } = e
      later($, () => mainTurnEnded($, reason, durationMs))
    }
    return r
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (e.trigger !== 'precompute' && e.agentId === undefined && r.skip === undefined) compacted = true
    return r
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    const r = await next(e)
    if (e.origin.kind === 'task-notification' && e.text.includes('<task-notification>')) {
      const { text } = e
      later($, () => notified($, text))
    }
    return r
  }).catch(($, e, next) => next(e))

  // The shortest answer a command has: no text, no context; the pane is the reply.
  if (opts.command) {
    on('command.run', { command: 'badges' }, async $ => {
      await openBook($)
      return {}
    }).catch(() => ({}))
  }

  // The footer. Desktop: what is beneath (the engine's labels, another mod's meter) and, at its right
  // end, one small pressable badge icon (`footerIcon`, a medal by default; the desktop draws a Button's
  // label as its face, so the label is the icon alone) that opens the book. The row's Box sets only flexDirection,
  // alignItems and columnGap: the engine skips a hook whose Box around its own drawing sets a size,
  // overflow, display or position. With nothing beneath but the engine's node and no labels for it
  // (no meter here, or a meter that wraps this row and draws its own ` · ` before it), no gap: the
  // icon takes only its own columns. Terminal (and the desktop with the icon off): one `◆ n` label
  // among the modes, as before.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'terminal') return next(e)
    const isIcon = e.surface === 'desktop' && opts.footerButton
    if (!isIcon && !opts.footerLabel) return next(e)
    if (!isIcon) {
      const n = countOf(await read($, EARNED))
      return n === 0 ? next(e) : next({ ...e, props: { ...e.props, modes: [...e.props.modes, `◆ ${n}`] } })
    }
    const beneath = await next(e)
    const isBare = typeof beneath === 'object' && beneath !== null && beneath.type === 'engine' && e.props.modes.length === 0
    const { Box, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="center" columnGap={isBare ? 0 : 1}>
        {beneath}
        <Button key={ICON} label={opts.footerIcon} plain dimColor onPress={() => void openBook($)} />
      </Box>
    )
  })

  // The band above the prompt, desktop only: what is drawn there already, with the pin drop and
  // plaque at its left for a few seconds after an unlock; otherwise the band is left as it was
  // drawn. One row beside what is beneath, not a row of its own under it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const drawn = await next(e)
    if (e.surface !== 'desktop' || e.props.hasSurvey || !opts.pinDrops) return drawn
    const flash = await read($, FLASH)
    const pins = flash?.pins ?? []
    const title = flash?.title ?? ''
    if (pins.length === 0 && !title) return drawn
    const names = pins.map(id => BY_ID.get(id)?.name ?? id)
    const { Box, Svg } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
        {pins.length > 0 && (
          <Svg source={dropFor(pins)} alt={`Badge unlocked: ${names.join(', ')}`} width={dropWidth(pins.length)} height={DROP_H} isInteractive />
        )}
        {title !== '' && <Svg source={plaqueFor(title)} alt={`New title: ${title}`} width={PLAQUE_W} height={PLAQUE_H} isInteractive />}
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          {drawn}
        </Box>
      </Box>
    )
  })

  // The book: its own pane, opened only by a press or /badges.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const earned = await read($, EARNED)
    const isHushed = await read($, HUSH)
    const kindled = await read($, KINDLED)
    const head = heading(earned)
    const told = stories(earned)
    const hushLabel = isHushed ? 'Unhush' : 'Hush unlocks'
    const kindledLine = `Kindled days: ${kindled.count} · best run ${kindled.best}`
    const empty = 'No badges yet. The first comes with the first answer of a workday.'
    if (e.surface === 'desktop') {
      const cols = colsFor(e.props.bodyColumns)
      lastCols = cols
      const { Box, Button, Svg, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Box flexDirection="column">
              <Text size="heading" weight="semibold">
                {head.title}
              </Text>
              <Text dimColor>{head.progress}</Text>
            </Box>
            <Button key="hush" dimColor onPress={() => void toggleHush($)}>
              {hushLabel}
            </Button>
          </Box>
          {shownChapters().map(chapter => (
            <Box flexDirection="column">
              <Text weight="semibold">{`${chapter.name}  ${badgesOf(chapter).filter(b => earned[b.id]).length}/${badgesOf(chapter).length}`}</Text>
              <Svg source={pageFor(chapter, earned, cols)} alt={pageAlt(chapter, earned)} />
            </Box>
          ))}
          {opts.kindledDays && <Text dimColor>{kindledLine}</Text>}
          <Text weight="semibold">Stories</Text>
          {told.length > 0 ? told.map(line => <Text>{line}</Text>) : <Text dimColor>{empty}</Text>}
        </Box>
      )
    }
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text>{`${head.title} · ${head.progress}`}</Text>
        {shownChapters().map(chapter => (
          <Text>{textRow(chapter, earned)}</Text>
        ))}
        {opts.kindledDays && <Text dimColor>{kindledLine}</Text>}
        {told.length > 0 ? told.map(line => <Text dimColor>{line}</Text>) : <Text dimColor>{empty}</Text>}
        <Button key="hush" onPress={() => void toggleHush($)}>
          {hushLabel}
        </Button>
      </Box>
    )
  })
}
