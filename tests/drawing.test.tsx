// What the person sees: the toast and its limits, the band's pin drop, plaque and button, the
// footer label, the book, and the switches that quiet each of them. Every drawing keeps next(e).
import { expect, test } from 'claude-code/testing'
import { BAND, BOOK, DAY, FOOTER, MIN, OPTS, SURFACES, T0, bash, earnedIds, ok, start, turnEnds, world } from './world'

const COMMIT_AND_PUSH = ok({ gitOperation: { commit: { sha: 'abcdef1', kind: 'committed', branch: 'main' }, push: { branch: 'main' } } })

test('one 5 s toast per unlock; unlocks together merge; at most one toast per 5 minutes', { options: OPTS }, async ($, on) => {
  const w = world(on)
  await start($)
  await bash($, w, 'git commit -m x && git push', COMMIT_AND_PUSH)
  expect(w.toasts).toEqual([])
  await w.clock.advance(1_500)
  expect(w.toasts).toEqual([{ text: 'Badges unlocked: First Stitch, First Ember and Sent Off', timeoutMs: 5_000 }])
  await w.clock.advance(MIN)
  await turnEnds($, w) // Clocked In, inside the 5 minutes
  await w.clock.advance(1_500)
  expect(w.toasts).toHaveLength(1)
  await w.clock.advance(4 * MIN)
  expect(w.toasts).toEqual([
    { text: 'Badges unlocked: First Stitch, First Ember and Sent Off', timeoutMs: 5_000 },
    { text: 'Badge unlocked: Clocked In', timeoutMs: 5_000 },
  ])
})

test('a toast another session showed a minute ago holds this one back until 5 minutes have passed', { options: OPTS }, async ($, on) => {
  const w = world(on, { store: { 'toast:last': T0 - MIN } })
  await start($)
  await turnEnds($, w)
  await w.clock.advance(1_500)
  expect(w.toasts).toEqual([])
  await w.clock.advance(4 * MIN)
  expect(w.toasts).toEqual([{ text: 'Badge unlocked: Clocked In', timeoutMs: 5_000 }])
})

test('the band keeps what is drawn there and adds the pin drop and plaque, then is left as drawn; no book button', { options: OPTS }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /^engine$/ })).toBeDefined()
    expect(await ui.find({ type: 'Button' })).toBeUndefined() // the book is opened from the footer now
    const svgs = await ui.findAll({ type: 'Svg' })
    if (surface === 'desktop') {
      expect(svgs.map(s => s.props.alt)).toEqual(['Badge unlocked: Clocked In', 'New title: Apprentice'])
      expect(svgs.every(s => s.props.isInteractive === true && String(s.props.source).startsWith('<svg'))).toBe(true)
      expect(svgs.map(s => [s.props.width, s.props.height])).toEqual([[58, 60], [232, 44]])
    } else {
      expect(svgs).toEqual([]) // the terminal's band is the engine's alone
    }
    await ui.unmount()
  }
  await w.clock.advance(8_000)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.drawn()).toMatchObject({ type: 'Text', children: ['engine'] }) // no empty row of ours
    await ui.unmount()
  }
})

test('the band keeps celebrating while Claude works, and yields to a survey', { options: OPTS }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  const busy = await $.ui.mount({ ...BAND, props: { ...BAND.props, isWorking: true }, surface: 'desktop' })
  expect((await busy.findAll({ type: 'Svg' })).map(s => s.props.alt)).toEqual(['Badge unlocked: Clocked In', 'New title: Apprentice'])
  expect(await busy.find({ type: 'Button' })).toBeUndefined()
  expect(await busy.find({ type: 'Text', text: /^engine$/ })).toBeDefined()
  await busy.unmount()
  const survey = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'desktop' })
  expect(await survey.drawn()).toMatchObject({ type: 'Text', children: ['engine'] })
  await survey.unmount()
  await w.clock.advance(8_000)
  const after = await $.ui.mount({ ...BAND, props: { ...BAND.props, isWorking: true }, surface: 'desktop' })
  expect(await after.drawn()).toMatchObject({ type: 'Text', children: ['engine'] }) // nothing of ours at all
  await after.unmount()
})

/** The Box props the engine refuses around its own drawing: a hook that sets one is skipped whole. */
const REFUSED_AROUND_ENGINE = ['width', 'height', 'minWidth', 'minHeight', 'overflow', 'display', 'position', 'top', 'left', 'right', 'bottom']

test('the desktop footer ends in one pressable badge icon (no count, no words) that opens the book; the terminal gets a ◆ n label', { options: OPTS }, async ($, on) => {
  const w = world(on)
  await start($)
  await w.clock.advance(1) // the store is read
  const empty = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
  const hollow = await empty.find({ type: 'Button', key: 'badge-book' })
  expect(hollow?.text).toBe('🏅')
  expect(hollow?.props.label).toBe('🏅')
  expect((await empty.find({ type: 'Text' }))?.text).toBe('modes: focus')
  await empty.unmount()
  const plain = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
  expect(await plain.drawn()).toMatchObject({ type: 'Text', children: ['modes: focus'] })
  await plain.unmount()
  await turnEnds($, w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...FOOTER, surface })
    if (surface === 'desktop') {
      expect((await ui.find({ type: 'Text' }))?.text).toBe('modes: focus') // no second ◆ among the labels
      const icon = await ui.find({ type: 'Button', key: 'badge-book' })
      expect(icon?.text).toBe('🏅')
      expect(icon?.props.label).toBe('🏅')
      expect(icon?.props.plain).toBe(true)
      expect(icon?.props.dimColor).toBe(true)
      const row = (await ui.drawn()) as { type: string; props: Record<string, unknown>; children: { type: string }[] }
      expect(row.type).toBe('Box')
      expect(row.props).toEqual({ flexDirection: 'row', alignItems: 'center', columnGap: 1 })
      expect(Object.keys(row.props).filter(k => REFUSED_AROUND_ENGINE.includes(k))).toEqual([])
      expect(row.children.map(c => c.type)).toEqual(['Text', 'Button']) // the labels first, the icon at the right end
      await ui.press({ key: 'badge-book' })
      expect(w.opened).toEqual(['badge-book'])
    } else {
      expect((await ui.find({ type: 'Text' }))?.text).toBe('modes: focus & ◆ 1')
      expect(await ui.find({ type: 'Button' })).toBeUndefined()
    }
    await ui.unmount()
  }
})

const at = (day: number): object => ({ at: T0 - day * DAY, where: 'my-repo', detail: 'earlier' })
const TWELVE = Object.fromEntries(
  ['first-stitch', 'sent-off', 'ribbon-cut', 'bridge-builder', 'untangler', 'knot-tied', 'second-draft', 'first-light', 'red-to-green', 'true-square', 'smooth-plane', 'fresh-gauge'].map(
    (id, i) => [`badge:${id}`, at(i + 1)],
  ),
)

test('the icon stays the icon alone however many badges; the terminal label counts them', { options: OPTS }, async ($, on) => {
  const w = world(on, { store: TWELVE })
  await start($)
  await w.clock.advance(1)
  const ui = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
  const icon = await ui.find({ type: 'Button', key: 'badge-book' })
  expect(icon?.text).toBe('🏅')
  expect(icon?.props.label).toBe('🏅')
  await ui.unmount()
  const text = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
  expect((await text.find({ type: 'Text' }))?.text).toBe('modes: focus & ◆ 12')
  await text.unmount()
})

test('a meter another mod draws beneath stays, with the icon after it', {
  options: OPTS,
  plugins: [
    {
      // A stand-in for another mod's footer meter: its meter, then what is beneath it (the engine's labels).
      name: 'meter',
      register(on) {
        on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
          const beneath = await next(e)
          const { Box, Text } = $.ui.resolve(e)
          return (
            <Box flexDirection="row">
              <Text dimColor>5h 58% ↻ 2h 10m</Text>
              <Text dimColor>{' · '}</Text>
              {beneath}
            </Box>
          )
        })
      },
    },
  ],
}, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  const ui = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
  expect((await ui.findAll({ type: 'Text' })).map(t => t.text)).toEqual(['5h 58% ↻ 2h 10m', ' · ', 'modes: focus'])
  const row = (await ui.drawn()) as { props: Record<string, unknown>; children: { type: string }[] }
  expect(row.props).toEqual({ flexDirection: 'row', alignItems: 'center', columnGap: 1 })
  expect(row.children.map(c => c.type)).toEqual(['Box', 'Button'])
  expect((await ui.find({ type: 'Button', key: 'badge-book' }))?.text).toBe('🏅')
  await ui.press({ key: 'badge-book' })
  expect(w.opened).toEqual(['badge-book'])
  await ui.unmount()
  const text = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
  expect((await text.findAll({ type: 'Text' })).map(t => t.text)).toEqual(['5h 58% ↻ 2h 10m', ' · ', 'modes: focus & ◆ 1'])
  await text.unmount()
})

test('over the engine’s own node with no labels the icon takes no gap; with labels, one', { options: OPTS }, async ($, on) => {
  // The engine's node as core answers it, beneath every plugin (no meter here, or one wrapping this row).
  on('ui.render', { component: 'SessionMode' }, () => ({ type: 'engine', ref: 0 }) as const)
  const w = world(on)
  await start($)
  await turnEnds($, w)
  for (const [modes, props] of [
    [[], { flexDirection: 'row', alignItems: 'center', columnGap: 0 }],
    [['focus'], { flexDirection: 'row', alignItems: 'center', columnGap: 1 }],
  ] as const) {
    const ui = await $.ui.mount({ ...FOOTER, props: { modes: [...modes] }, surface: 'desktop' })
    const row = (await ui.drawn()) as { props: Record<string, unknown>; children: { type: string }[] }
    expect(row.props).toEqual(props)
    expect(row.children.map(c => c.type)).toEqual(['engine', 'Button']) // the engine's node kept, once
    expect((await ui.find({ type: 'Button', key: 'badge-book' }))?.text).toBe('🏅')
    await ui.press({ key: 'badge-book' })
    await ui.unmount()
  }
  expect(w.opened).toEqual(['badge-book', 'badge-book'])
})

test('footerButton: false puts the count back among the desktop labels', { options: { ...OPTS, footerButton: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...FOOTER, surface })
    expect(await ui.drawn()).toMatchObject({ type: 'Text', children: ['modes: focus & ◆ 1'] })
    await ui.unmount()
  }
})

test('footerLabel: false leaves the terminal footer alone and keeps the desktop icon', { options: { ...OPTS, footerLabel: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  const text = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
  expect(await text.drawn()).toMatchObject({ type: 'Text', children: ['modes: focus'] })
  await text.unmount()
  const desk = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
  expect((await desk.find({ type: 'Text' }))?.text).toBe('modes: focus')
  expect((await desk.find({ type: 'Button', key: 'badge-book' }))?.text).toBe('🏅')
  await desk.unmount()
})

test('footerButton and footerLabel both off leave the footer to the engine', { options: { ...OPTS, footerButton: false, footerLabel: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...FOOTER, surface })
    expect(await ui.drawn()).toMatchObject({ type: 'Text', children: ['modes: focus'] })
    await ui.unmount()
  }
})

test('an old bookButton setting still loads, and changes nothing', { options: { ...OPTS, bookButton: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.commands).toEqual(['badges'])
  await turnEnds($, w)
  const ui = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
  expect((await ui.find({ type: 'Button', key: 'badge-book' }))?.text).toBe('🏅')
  await ui.unmount()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Button' })).toBeUndefined()
  expect(await band.findAll({ type: 'Svg' })).toHaveLength(2)
  await band.unmount()
})

test('quiet: no toast, pin drop or plaque, and the badge still counts', { options: { ...OPTS, quiet: true } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  await w.clock.advance(2_000)
  expect(earnedIds(w)).toEqual(['clocked-in'])
  expect(w.toasts).toEqual([])
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.findAll({ type: 'Svg' })).toEqual([])
  await band.unmount()
  const footer = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
  expect((await footer.find({ type: 'Button', key: 'badge-book' }))?.text).toBe('🏅')
  await footer.unmount()
})

test('toasts: false keeps the pin drop; pinDrops: false keeps the band the engine’s', { options: { ...OPTS, toasts: false, pinDrops: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  await w.clock.advance(2_000)
  expect(w.toasts).toEqual([])
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.drawn()).toMatchObject({ type: 'Text', children: ['engine'] })
  await band.unmount()
})

test('pinDrops: false keeps the toast', { options: { ...OPTS, pinDrops: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  await w.clock.advance(2_000)
  expect(w.toasts.map(t => t.text)).toEqual(['Badge unlocked: Clocked In'])
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.findAll({ type: 'Svg' })).toEqual([])
  await band.unmount()
})

test('Hush in the book quiets unlocks without a reload, and is kept', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY }) // a day off: no Clocked In
  await start($)
  const book = await $.ui.mount({ ...BOOK, surface: 'desktop' })
  await book.press({ key: 'hush' })
  expect(w.store.get('hush')).toBe(true)
  expect((await book.find({ type: 'Button', key: 'hush' }))?.text).toBe('Unhush')
  await bash($, w, 'git commit -m x && git push', COMMIT_AND_PUSH)
  await w.clock.advance(2_000)
  expect(earnedIds(w)).toEqual(['ember', 'first-stitch', 'sent-off'])
  expect(w.toasts).toEqual([])
  await book.press({ key: 'hush' })
  expect(w.store.get('hush')).toBe(false)
  await book.unmount()
})

test('a second title the same day waits for the next day’s plaque', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await bash($, w, 'git commit -m x && git push', COMMIT_AND_PUSH) // three badges: Apprentice, then Tinkerer
  let band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.findAll({ type: 'Svg' })).map(s => s.props.alt)).toEqual([
    'Badge unlocked: First Stitch, First Ember, Sent Off',
    'New title: Apprentice',
  ])
  await band.unmount()
  await w.clock.advance(2 * DAY) // Monday
  await turnEnds($, w) // Clocked In; Tinkerer's plaque now
  band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.findAll({ type: 'Svg' })).map(s => s.props.alt)).toEqual(['Badge unlocked: Clocked In', 'New title: Tinkerer'])
  await band.unmount()
})

test('/badges opens the book and answers with no text', { options: OPTS }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.commands).toEqual(['badges'])
  const r = await $.command.run({ command: 'badges', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  expect(r.text).toBeUndefined()
  expect(r.context).toBeUndefined()
  expect(w.opened).toEqual(['badge-book'])
})

test('command: false registers no /badges', { options: { ...OPTS, command: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  expect(w.commands).toEqual([])
})

test('the book: parchment pages on desktop, text rows elsewhere; hidden badges stay "?"', { options: OPTS }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BOOK, surface })
    expect(await ui.find({ type: 'Text', text: /Apprentice/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Clocked In, in my-repo: first answer of a Wednesday/ })).toBeDefined()
    if (surface === 'desktop') {
      const pages = await ui.findAll({ type: 'Svg' })
      expect(pages).toHaveLength(8)
      expect(pages[3]?.props.alt).toBe('Endurance: 1 of 4 badges earned: Clocked In.')
      expect(String(pages[3]?.props.source)).toContain('>Clocked In<')
      expect(String(pages[3]?.props.source)).not.toContain('Second Wind')
      expect(String(pages[3]?.props.source)).toContain('>?<') // hidden until earned
      expect(String(pages[3]?.props.source)).toContain('A 30-minute turn') // a locked pin's hint
    } else {
      expect((await ui.find({ type: 'Text', text: /^Endurance/ }))?.text).toBe('Endurance 1/4: ◆ Clocked In  ◇ Long Haul  ◇ ?  ◇ Clean Sweep')
    }
    await ui.unmount()
  }
})

test('hiddenHints shows hidden badges as silhouettes; chapters switched off leave the book', { options: { ...OPTS, hiddenHints: true, oddities: false, kindledDays: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  const text = await $.ui.mount({ ...BOOK, surface: 'terminal' })
  expect((await text.find({ type: 'Text', text: /^Endurance/ }))?.text).toBe('Endurance 1/4: ◆ Clocked In  ◇ Long Haul  ◇ Second Wind  ◇ Clean Sweep')
  expect(await text.find({ type: 'Text', text: /^Oddities/ })).toBeUndefined()
  expect(await text.find({ type: 'Text', text: /Kindled/ })).toBeUndefined()
  await text.unmount()
  const pages = await $.ui.mount({ ...BOOK, surface: 'desktop' })
  const svgs = await pages.findAll({ type: 'Svg' })
  expect(svgs).toHaveLength(6)
  expect(String(svgs[3]?.props.source)).toContain('Second Wind')
  await pages.unmount()
})

test('badges: false leaves the band and the footer to the engine', { options: { ...OPTS, badges: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  for (const surface of SURFACES) {
    const band = await $.ui.mount({ ...BAND, surface })
    expect(await band.drawn()).toMatchObject({ type: 'Text', children: ['engine'] })
    await band.unmount()
    const footer = await $.ui.mount({ ...FOOTER, surface })
    expect(await footer.drawn()).toMatchObject({ type: 'Text', children: ['modes: focus'] })
    await footer.unmount()
  }
})

test('footerIcon sets the one character the footer button shows, and nothing else', { options: { ...OPTS, footerIcon: '◆' } }, async ($, on) => {
  const w = world(on)
  await start($)
  await w.clock.advance(1)
  const ui = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
  const icon = await ui.find({ type: 'Button', key: 'badge-book' })
  expect(icon?.props.label).toBe('◆')
  expect(icon?.text).toBe('◆')
  await ui.unmount()
})
