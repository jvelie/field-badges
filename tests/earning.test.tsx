// What earns which badge, from the events the mod observes, and that every observer hands on
// exactly what it was given.
import { expect, test } from 'claude-code/testing'
import { DAY, MESSAGES, MIN, OPTS, REFUSED, SPAWN, T0, bash, earnedIds, failed, ok, start, turnEnds, world } from './world'

test('Clocked In: the first answered main turn of a workday, once ever', { options: OPTS }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  expect(w.store.get('badge:clocked-in')).toEqual({ at: T0 + 1, where: 'my-repo', detail: 'first answer of a Wednesday' })
  await turnEnds($, w)
  await w.clock.advance(DAY)
  await turnEnds($, w)
  expect(earnedIds(w)).toEqual(['clocked-in'])
})

test('a subagent turn, an interrupted turn and a day off earn nothing', { options: OPTS }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w, { agentId: 'helper' })
  await turnEnds($, w, { reason: 'aborted' })
  expect(earnedIds(w)).toEqual([])
  await w.clock.set(T0 + 3 * DAY) // Saturday
  await turnEnds($, w)
  expect(earnedIds(w)).toEqual([])
})

test('the workdays option moves the week', { options: { ...OPTS, workdays: 'Sat-Sun' } }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await turnEnds($, w)
  expect(w.store.get('badge:clocked-in')).toMatchObject({ detail: 'first answer of a Saturday' })
})

test('a badge another session already earned is taken in without a second celebration', { options: OPTS }, async ($, on) => {
  const w = world(on, { store: { 'badge:clocked-in': { at: T0 - DAY, where: 'other', detail: 'first answer of a Tuesday' } } })
  await start($)
  await turnEnds($, w)
  await w.clock.advance(2_000)
  expect(w.store.get('badge:clocked-in')).toMatchObject({ where: 'other' })
  expect(w.toasts).toEqual([])
})

test('Long Haul and Second Wind come from the main turn; a precompute is no compaction', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY }) // a day off, so Clocked In stays out of the way
  await start($)
  await $.session.compact({ trigger: 'precompute', messages: MESSAGES })
  await turnEnds($, w, { durationMs: 29 * MIN })
  expect(earnedIds(w)).toEqual([])
  await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  await turnEnds($, w, { durationMs: 31 * MIN })
  expect(earnedIds(w)).toEqual(['long-haul', 'second-wind'])
  expect(w.store.get('badge:long-haul')).toMatchObject({ detail: 'a 31-minute turn ended with an answer' })
})

test('git: a commit and a push in one command; a rebase; a merged pull request', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  const git = { commit: { sha: 'abcdef123456', kind: 'committed', branch: 'main' }, push: { branch: 'main' } }
  await bash($, w, 'git commit -m "x" && git push', ok({ gitOperation: git }))
  expect(earnedIds(w)).toEqual(['ember', 'first-stitch', 'sent-off'])
  expect(w.store.get('badge:first-stitch')).toMatchObject({ detail: 'commit abcdef1 on main' })
  await bash($, w, 'git rebase main', ok({ gitOperation: { branch: { ref: 'main', action: 'rebased' } } }))
  await bash($, w, 'gh pr merge 12', ok({ gitOperation: { pr: { number: 12, action: 'merged' } } }), 'helper')
  expect(w.store.get('badge:untangler')).toMatchObject({ detail: 'rebase of main went through' })
  expect(w.store.get('badge:bridge-builder')).toMatchObject({ detail: 'pull request #12 merged' })
})

test('Red to Green: a test run passes within 15 minutes of failing', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await bash($, w, 'npm test', failed('Exit code 1\nTests: 2 failed, 10 passed'))
  expect(earnedIds(w)).toEqual([])
  await w.clock.advance(10 * MIN)
  await bash($, w, 'npm test', ok({ stdout: 'Tests: 12 passed' }))
  expect(earnedIds(w)).toEqual(['first-light', 'red-to-green'])
  expect(w.store.get('badge:red-to-green')).toMatchObject({ detail: 'npm test went green 10 min after failing' })
})

test('Red to Green: not after 15 minutes, nor after a refusal at the permission card', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await bash($, w, 'pytest -q', REFUSED)
  await bash($, w, 'pytest -q', ok({ stdout: '3 passed' }))
  expect(earnedIds(w)).toEqual(['first-light'])
  await bash($, w, 'pytest -q', failed('Exit code 1\n1 failed'))
  await w.clock.advance(20 * MIN)
  await bash($, w, 'pytest -q', ok({ stdout: '3 passed' }))
  expect(earnedIds(w)).toEqual(['first-light'])
})

test('a run piped through tail that prints failures is a failure; a type check clean again is True Square', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await bash($, w, 'npm test 2>&1 | tail -5', ok({ stdout: 'Tests: 1 failed, 9 passed' }))
  await bash($, w, 'npx tsc --noEmit', failed('Exit code 2\nsrc/a.ts(3,1): error TS2304: Cannot find name x.'))
  await w.clock.advance(5 * MIN)
  await bash($, w, 'npm test', ok({ stdout: 'Tests: 10 passed' }))
  await bash($, w, 'npx tsc --noEmit', ok())
  expect(earnedIds(w)).toEqual(['first-light', 'red-to-green', 'true-square'])
})

test('Oddities: an error flavour once ever, never from a refusal; off with oddities: false', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await bash($, w, 'cat nope.txt', REFUSED)
  expect(earnedIds(w)).toEqual([])
  await bash($, w, 'cat nope.txt', failed('Exit code 1\ncat: nope.txt: No such file or directory'))
  expect(w.store.get('badge:odd-eclair')).toMatchObject({ detail: 'No such file or directory, in Bash' })
  w.answers.push(failed('File does not exist.'))
  await $.tool.call({ tool: 'Read', file_path: 'C:\\x\\gone.ts' })
  await w.clock.advance(1)
  await bash($, w, 'npm ci', failed('Exit code 243\nnpm ERR! code EACCES'))
  expect(earnedIds(w)).toEqual(['odd-eclair', 'odd-pate'])
})

test('oddities: false tastes nothing', { options: { ...OPTS, oddities: false } }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await bash($, w, 'cat nope.txt', failed('Exit code 1\ncat: nope.txt: No such file or directory'))
  expect(earnedIds(w)).toEqual([])
})

test('Crew: First Mate, Lookout and Conductor count the main loop’s own helpers', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await $.turn.start({ text: 'fan out', turnId: 't1' })
  await $.agent.spawn({ ...SPAWN, parentAgentId: 'helper' })
  await $.agent.spawn({ ...SPAWN, workflow: { runId: 'wf_1', agentIndex: 1 } })
  await w.clock.advance(1)
  expect(earnedIds(w)).toEqual([])
  await $.agent.spawn({ ...SPAWN, subagentType: 'Explore' })
  for (let i = 0; i < 3; i++) await $.agent.spawn(SPAWN)
  await w.clock.advance(1)
  expect(earnedIds(w)).toEqual(['first-mate', 'lookout'])
  await $.agent.spawn(SPAWN)
  await w.clock.advance(1)
  expect(earnedIds(w)).toEqual(['conductor', 'first-mate', 'lookout'])
  expect(w.store.get('badge:conductor')).toMatchObject({ detail: '5 helpers in one turn' })
})

test('Bridgewalker and Polyglot: one main turn, never a subagent’s calls', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await bash($, w, 'ls C:\\Users\\me', ok(), 'helper')
  await bash($, w, 'ls \\\\wsl.localhost\\Ubuntu\\home', ok(), 'helper')
  expect(earnedIds(w)).toEqual([])
  w.answers.push({ result: { type: 'update', filePath: 'C:\\w\\a.ts', content: '', structuredPatch: [], originalFile: '' } })
  await $.tool.call({ tool: 'Write', file_path: 'C:\\w\\a.ts', content: '' })
  w.answers.push({ result: { type: 'update', filePath: '/home/me/b.py', content: '', structuredPatch: [], originalFile: '' } })
  await $.tool.call({ tool: 'Write', file_path: '/home/me/b.py', content: '' })
  await w.clock.advance(1)
  expect(earnedIds(w)).toEqual(['bridgewalker'])
  for (const file of ['c.rs', 'd.go']) {
    w.answers.push({ result: { type: 'update', filePath: file, content: '', structuredPatch: [], originalFile: '' } })
    await $.tool.call({ tool: 'Write', file_path: `C:\\w\\${file}`, content: '' })
  }
  await w.clock.advance(1)
  expect(w.store.get('badge:polyglot')).toMatchObject({ detail: 'TypeScript, Python, Rust, Go in one turn' })
})

test('Craft: Blank Page, Fresh Gauge, Lean Cut; Clean Sweep from a to-do list', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  w.answers.push({ result: { type: 'create', filePath: 'x', content: '', structuredPatch: [], originalFile: null } })
  await $.tool.call({ tool: 'Write', file_path: 'C:\\w\\tests\\pin.test.ts', content: '' })
  const edit = { filePath: 'big.ts', oldString: '', newString: '', originalFile: '', structuredPatch: [], userModified: false, replaceAll: false }
  w.answers.push({ result: { ...edit, gitDiff: { filename: 'big.ts', status: 'modified', additions: 20, deletions: 140, changes: 160, patch: '' } } })
  await $.tool.call({ tool: 'Edit', file_path: 'C:\\w\\big.ts', old_string: 'a', new_string: 'b' })
  w.answers.push({ result: { ...edit, structuredPatch: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] }] } })
  await $.tool.call({ tool: 'Edit', file_path: 'C:\\w\\small.ts', old_string: 'a', new_string: 'b' })
  await w.clock.advance(1)
  expect(earnedIds(w)).toEqual(['blank-page', 'fresh-gauge', 'lean-cut'])
  expect(w.store.get('badge:lean-cut')).toMatchObject({ detail: 'big.ts: 120 more lines out than in' })

  const todo = (status: 'pending' | 'completed') => Array.from({ length: 8 }, (_, i) => ({ content: `t${i}`, status, activeForm: `t${i}` }))
  w.answers.push({ result: { oldTodos: todo('pending'), newTodos: todo('completed') } })
  await $.tool.call({ tool: 'TodoWrite', todos: todo('completed') })
  await w.clock.advance(1)
  expect(w.store.get('badge:clean-sweep')).toMatchObject({ detail: '8 to-dos, all done' })
})

test('Workflows: launched, back home, a long voyage; a background command finished; the prompt passes unchanged', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  w.answers.push({ result: { status: 'async_launched', taskId: 'w1', runId: 'wf_a', workflowName: 'build' } })
  await $.tool.call({ tool: 'Workflow', scriptPath: 'C:\\s.js' })
  await bash($, w, 'npm run serve', ok({ backgroundTaskId: 'b1' }))
  expect(earnedIds(w)).toEqual(['shipwright'])
  await w.clock.advance(31 * MIN)
  const text = ['w1', 'b1'].map(id => `<task-notification><task-id>${id}</task-id><status>completed</status></task-notification>`).join('\n')
  const entered = await $.prompt.submit({ text, origin: { kind: 'task-notification' }, wait: false })
  expect(entered).toEqual({ text, origin: { kind: 'task-notification' } })
  await w.clock.advance(1)
  expect(earnedIds(w)).toEqual(['fleet-return', 'hands-free', 'long-voyage', 'shipwright'])
  expect(w.store.get('badge:long-voyage')).toMatchObject({ detail: 'build finished after 31 min' })
  expect(w.store.has('wf:w1')).toBe(false)
})

test('Kindled Days: a day off between workdays keeps the run; Three Coals on the third', { options: OPTS }, async ($, on) => {
  const friday = T0 - 5 * DAY
  const w = world(on, { now: friday })
  await start($)
  const commit = ok({ gitOperation: { commit: { sha: '1111111', kind: 'committed' } } })
  await bash($, w, 'git commit -m a', commit)
  await w.clock.set(friday + 3 * DAY) // Monday
  await bash($, w, 'git commit -m b', commit)
  expect(earnedIds(w)).not.toContain('three-coals')
  await w.clock.set(friday + 4 * DAY) // Tuesday
  await bash($, w, 'git commit -m c', commit)
  expect(w.store.get('badge:three-coals')).toMatchObject({ detail: '3 kindled workdays running' })
  expect([...w.store.keys()].filter(k => k.startsWith('kindled:')).sort()).toEqual(['kindled:2026-10-23', 'kindled:2026-10-26', 'kindled:2026-10-27'])
})

test('kindledDays: false records no day', { options: { ...OPTS, kindledDays: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await bash($, w, 'git commit -m a', ok({ gitOperation: { commit: { sha: '1111111', kind: 'committed' } } }))
  expect(earnedIds(w)).toEqual(['first-stitch'])
  expect([...w.store.keys()].some(k => k.startsWith('kindled:'))).toBe(false)
})

test('a git run wrapped in wsl.exe earns from git’s own lines; installing or grepping a test tool is no test run', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  const pushed = ok({ stdout: '[main 1a2b3c4] fix pytest\n 1 file changed', stderr: 'To github.com:me/x.git\n   1a2b3c4..5d6e7f8  main -> main' })
  await bash($, w, `wsl.exe -d Ubuntu -e bash -lc 'cd ~/x && git commit -m "fix pytest" && git push'`, pushed)
  expect(earnedIds(w)).toEqual(['ember', 'first-stitch', 'sent-off'])
  expect(w.store.get('badge:first-stitch')).toMatchObject({ detail: 'commit 1a2b3c4 on main' })
  await bash($, w, 'npm install -D vitest', ok({ stdout: 'added 40 packages' }))
  await bash($, w, 'cd app && grep -rn jest src', ok())
  expect(earnedIds(w)).toEqual(['ember', 'first-stitch', 'sent-off']) // no First Light
})

test('a staged write, a hook’s refusal, a refused edit and a launch that failed its check count for nothing', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  w.answers.push({ result: { type: 'create', filePath: 'x', content: '', structuredPatch: [], originalFile: null, staged: true } })
  await $.tool.call({ tool: 'Write', file_path: 'C:\\w\\tests\\new.test.ts', content: '' })
  w.answers.push({ deny: 'blocked by policy' })
  await $.tool.call({ tool: 'Write', file_path: 'C:\\w\\b.ts', content: '' })
  w.answers.push(failed('The user doesn’t want to proceed with this tool use. The tool use was rejected. The user said: that file does not exist'))
  await $.tool.call({ tool: 'Edit', file_path: 'C:\\w\\c.ts', old_string: 'a', new_string: 'b' })
  w.answers.push({ result: { status: 'async_launched', taskId: 'w1', error: 'SyntaxError: Unexpected token' } })
  await $.tool.call({ tool: 'Workflow', scriptPath: 'C:\\s.js' })
  await w.clock.advance(1)
  expect(earnedIds(w)).toEqual([])
  expect(w.store.has('wf:w1')).toBe(false)
})

test('Lean Cut counts the edit’s own lines, not the file’s whole uncommitted diff', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  const patch = [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] }]
  const gitDiff = { filename: 'big.ts', status: 'modified', additions: 0, deletions: 300, changes: 300, patch: '' }
  w.answers.push({ result: { filePath: 'big.ts', oldString: 'a', newString: 'b', originalFile: '', structuredPatch: patch, userModified: false, replaceAll: false, gitDiff } })
  await $.tool.call({ tool: 'Edit', file_path: 'C:\\w\\big.ts', old_string: 'a', new_string: 'b' })
  await w.clock.advance(1)
  expect(earnedIds(w)).toEqual([])
})

test('an error flavour at the end of a long output is still tasted', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await bash($, w, 'npm run build', failed(`Exit code 1\n${'compiling…\n'.repeat(600)}Error: Cannot find module 'left-pad'`))
  expect(w.store.get('badge:odd-macaron')).toMatchObject({ detail: 'Cannot find module, in Bash' })
})

test('a subagent’s compaction is no Second Wind', { options: OPTS }, async ($, on) => {
  const w = world(on, { now: T0 + 3 * DAY })
  await start($)
  await $.session.compact({ trigger: 'auto', agentId: 'helper', messages: MESSAGES })
  await turnEnds($, w)
  expect(earnedIds(w)).toEqual([])
})

test('every observer hands on what it was given', { options: OPTS }, async ($, on) => {
  const w = world(on)
  await start($)
  w.answers.push(failed('Exit code 1\nboom'))
  expect(await $.tool.call({ tool: 'Bash', command: 'make' })).toEqual({ isError: true, result: 'Exit code 1\nboom', text: 'Exit code 1\nboom' })
  expect(await $.agent.spawn(SPAWN)).toEqual({ model: 'claude-test', agentId: 'a1' })
  expect(await $.turn.complete({ answer: 'a', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })).toEqual({ text: '' })
  expect(await $.session.compact({ trigger: 'manual', messages: MESSAGES })).toEqual({ messages: MESSAGES })
  expect(await $.prompt.submit({ text: 'hi', origin: { kind: 'composer' }, wait: false })).toEqual({ text: 'hi', origin: { kind: 'composer' } })
})

test('badges: false records nothing and registers no command', { options: { ...OPTS, badges: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await turnEnds($, w)
  await bash($, w, 'git commit -m a', ok({ gitOperation: { commit: { sha: '1111111', kind: 'committed' } } }))
  expect(w.store.size).toBe(0)
  expect(w.commands).toEqual([])
})
