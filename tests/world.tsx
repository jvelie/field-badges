// The world beneath field-badges in a test: every $ call it makes is answered here, as the engine
// would answer it, and what it showed (toasts, panes, commands, store writes) is kept for checking.
import type { On } from 'claude-code'
import { mock, type Engine, type MockClock } from 'claude-code/testing'

/** Wednesday 28 Oct 2026, 09:00 UTC. */
export const T0 = Date.UTC(2026, 9, 28, 9, 0)
export const DAY = 86_400_000
export const MIN = 60_000
/** Tests read the calendar in UTC, whatever the clock the test environment keeps. */
export const OPTS = { utcOffset: '+00:00' } as const
export const SURFACES = ['terminal', 'desktop'] as const
export const CWD = 'C:\\work\\my-repo'

export type World = {
  clock: MockClock
  store: Map<string, unknown>
  toasts: { text: string; timeoutMs: number | undefined }[]
  opened: string[]
  commands: string[]
  /** What the next tool calls answer, in order; then an empty Bash record. */
  answers: unknown[]
  spawns: number
}

export function world(on: On, init: { now?: number; store?: Record<string, unknown> } = {}): World {
  const clock = mock.clock(on, { now: init.now ?? T0 })
  const w: World = { clock, store: new Map(Object.entries(init.store ?? {})), toasts: [], opened: [], commands: [], answers: [], spawns: 0 }
  on('store.get', (_, e) => ({ value: w.store.get(e.key) }))
  on('store.set', (_, e) => {
    w.store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    w.store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...w.store.keys()] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('command.register', (_, e) => {
    w.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_, e) => {
    w.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', (_, e) => {
    w.toasts.push({ text: e.text, timeoutMs: e.timeoutMs })
    return { value: undefined }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.compact', (_, e) => ({ messages: e.messages }))
  on('prompt.submit', (_, e) => ({ text: e.text, origin: e.origin }))
  on('agent.spawn', () => ({ model: 'claude-test', agentId: `a${++w.spawns}` }))
  on('tool.call', () => (w.answers.shift() ?? { result: { stdout: '', stderr: '', interrupted: false } }) as never)
  // The engine's own drawing, beneath every plugin: a test sees whether a hook kept it.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    if (e.component === 'SessionMode') return <Text>{`modes: ${e.props.modes.join(' & ')}`}</Text>
    return <Text>engine</Text>
  })
  return w
}

export const start = ($: Engine): Promise<unknown> => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })

/** A main-loop turn (or an agent's, given its id) that ends as `reason` says, then the follow-up timer. */
export async function turnEnds(
  $: Engine,
  w: World,
  o: { durationMs?: number; agentId?: string; reason?: 'answer' | 'aborted' | 'error' } = {},
): Promise<void> {
  const loop = o.agentId === undefined ? {} : { agentId: o.agentId }
  const reason = o.reason ?? 'answer'
  await $.turn.start({ text: 'go on', turnId: 't1', ...loop })
  await $.turn.complete({ answer: 'done', durationMs: o.durationMs ?? 60_000, isAborted: reason === 'aborted', turnId: 't1', reason, ...loop })
  await w.clock.advance(1)
}

/** What a compaction runs over: one message, as a real one leaves at least one. */
export const MESSAGES = [{ role: 'user' as const, text: 'summary', toolUses: [] }]

export const ok = (rec: object = {}): object => ({ result: { stdout: '', stderr: '', interrupted: false, ...rec } })
export const failed = (text: string): object => ({ isError: true, result: text, text })
export const REFUSED = failed('The user doesn’t want to proceed with this tool use. The tool use was rejected.')

/** A Bash call answered with `answer`, then the follow-up timer. */
export async function bash($: Engine, w: World, command: string, answer: object = ok(), agentId?: string): Promise<void> {
  w.answers.push(answer)
  await $.tool.call({ tool: 'Bash', command, ...(agentId === undefined ? {} : { agentId }) })
  await w.clock.advance(1)
}

export const SPAWN = {
  tool_use_id: 'toolu_agent',
  prompt: 'look around',
  description: 'look around the repo',
  subagentType: 'general-purpose',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'claude-test',
  background: false,
  fork: false,
} as const

export const BAND = {
  plugin: 'field-badges',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} },
} as const

export const FOOTER = { plugin: 'field-badges', component: 'SessionMode', requestId: 'footer', props: { modes: ['focus'] } } as const

export const BOOK = {
  plugin: 'field-badges',
  component: 'Pane',
  requestId: 'badge-book',
  props: { title: 'Badge book', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

/** The ids of the badges the store holds, sorted. */
export const earnedIds = (w: World): string[] =>
  [...w.store.keys()]
    .filter(k => k.startsWith('badge:'))
    .map(k => k.slice(6))
    .sort()
