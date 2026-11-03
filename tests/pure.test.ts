// The pure parts: the catalog, the readers of what a call did, the calendar, and the art.
import { expect, test } from 'claude-code/testing'
import { DROP_H, GLYPHS, PLAQUE_H, PLAQUE_W, dropSvg, dropWidth, pageSvg, pinMarkup, plaqueSvg, shade } from '../hooks/art'
import { BADGES, BY_ID, CHAPTERS, TITLES, titleIndex } from '../hooks/badges'
import {
  bestRun,
  classifyCheck,
  dayKey,
  gitFromOutput,
  headTail,
  isRefusal,
  isTestFile,
  languageOf,
  netRemoved,
  oddityOf,
  parseNotifications,
  parseOffset,
  parseWorkdays,
  sides,
  toastText,
  verdict,
  when,
  wrap2,
} from '../hooks/detect'

test('the catalog: unique ids, a glyph and a chapter for each, hints that fit two lines', () => {
  expect(new Set(BADGES.map(b => b.id)).size).toBe(BADGES.length)
  expect(BADGES.length).toBe(44)
  for (const b of BADGES) {
    expect(GLYPHS[b.id], b.id).toBeDefined()
    expect(CHAPTERS.some(c => c.id === b.chapter), b.id).toBe(true)
    expect(b.short.length, b.id).toBeLessThanOrEqual(16)
    expect(b.hint.length, b.id).toBeLessThanOrEqual(40)
  }
  for (const c of CHAPTERS) expect(BADGES.some(b => b.chapter === c.id), c.id).toBe(true)
  expect(BY_ID.get('untangler')?.name).toBe('Untangler')
})

test('twelve titles, climbing', () => {
  expect(TITLES.map(t => t.name)).toEqual([
    'Apprentice', 'Tinkerer', 'Wrenchhand', 'Fitter', 'Journeyer', 'Lathe-wise',
    'Joiner', 'Artificer', 'Draftmaster', 'Keystone', 'Master of Small Things', 'Old Hand',
  ])
  expect(TITLES.every((t, i) => i === 0 || t.at > TITLES[i - 1]!.at)).toBe(true)
  expect(TITLES[TITLES.length - 1]!.at).toBeLessThanOrEqual(BADGES.length)
  expect([0, 1, 2, 3, 40, 44].map(titleIndex)).toEqual([-1, 0, 0, 1, 11, 11])
})

test('classifyCheck: test, type check and lint runs; reading about a tool is none', () => {
  expect(classifyCheck('npm test')).toEqual({ kind: 'test', label: 'npm test' })
  expect(classifyCheck('cd app && pnpm run test -- --watch=false')?.kind).toBe('test')
  expect(classifyCheck('python -m pytest -q tests/')?.label).toBe('python -m pytest')
  expect(classifyCheck("MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -e bash -lc 'bash ~/repo/scripts/check.sh x'")?.kind).toBe('test')
  expect(classifyCheck('claude.exe plugin test ./x')?.kind).toBe('test')
  expect(classifyCheck('npx tsc --noEmit -p .')).toEqual({ kind: 'type', label: 'tsc' })
  expect(classifyCheck('cargo clippy --all')?.kind).toBe('lint')
  expect(classifyCheck('npx eslint src')?.kind).toBe('lint')
  expect(classifyCheck('grep -rn pytest .')).toBeUndefined()
  expect(classifyCheck('cat tsconfig.json')).toBeUndefined()
  expect(classifyCheck('pytest --version')).toBeUndefined()
  expect(classifyCheck('git status')).toBeUndefined()
})

test('classifyCheck: installing, committing, grepping or echoing about a test tool runs no check', () => {
  const words = [
    'npm install -D vitest',
    'pnpm add -D jest',
    'pip install pytest',
    'python -m pip install pytest',
    'git commit -m "make pytest pass"',
    "git commit -m \"$(cat <<'EOF'\nFix the jest config\n\nRun npm test after.\nEOF\n)\"",
    'cd app && grep -rn jest src',
    'echo "run npm test" && ls',
    "wsl.exe -d Ubuntu -e bash -lc 'git commit -m \"fix tsc errors\"'",
  ]
  for (const c of words) expect(classifyCheck(c), c).toBeUndefined()
  expect(classifyCheck('npm test 2>&1 | tail -5')).toEqual({ kind: 'test', label: 'npm test' })
  expect(classifyCheck('git add . && npm test')?.label).toBe('npm test')
  expect(classifyCheck('CI=1 time npx vitest run')?.kind).toBe('test')
  expect(classifyCheck("wsl.exe -d Ubuntu -e bash -lc 'cd ~/app && npx tsc --noEmit'")).toEqual({ kind: 'type', label: 'tsc' })
})

test('gitFromOutput: git’s own lines stand in for a missing gitOperation, only where the command agrees', () => {
  const wrap = (cmd: string): string => `wsl.exe -d Ubuntu -e bash -lc 'cd ~/x && ${cmd}'`
  const out = '[main 1a2b3c4] x\n 1 file changed\nTo github.com:me/x.git\n   1a2b3c4..5d6e7f8  main -> main'
  expect(gitFromOutput(wrap('git commit -m "x" && git push'), out)).toEqual({
    commit: { sha: '1a2b3c4', kind: 'committed', branch: 'main' },
    push: { branch: 'main' },
  })
  expect(gitFromOutput(wrap('git commit --amend --no-edit'), '[feat/x 9f8e7d6] x')?.commit).toEqual({ sha: '9f8e7d6', kind: 'amended', branch: 'feat/x' })
  expect(gitFromOutput('git commit -m first', '[main (root-commit) abcdef0] first')?.commit?.branch).toBe('main')
  expect(gitFromOutput('git cherry-pick 1234567', '[detached HEAD 7654321] y')?.commit).toEqual({ sha: '7654321', kind: 'cherry-picked' })
  expect(gitFromOutput('git push -u origin feat', ' * [new branch]      feat -> feat')?.push).toEqual({ branch: 'feat' })
  expect(gitFromOutput('git rebase main', 'Successfully rebased and updated refs/heads/feat.')?.branch).toEqual({ ref: 'feat', action: 'rebased' })
  expect(gitFromOutput('git merge --no-ff feat', "Merge made by the 'ort' strategy.")?.branch).toEqual({ ref: 'feat', action: 'merged' })
  expect(gitFromOutput('gh pr create --fill', 'https://github.com/me/x/pull/42\n')?.pr).toEqual({ number: 42, action: 'created' })
  expect(gitFromOutput('gh pr merge 42 --squash', '✓ Squashed and merged pull request me/x#42 (Fix)')?.pr).toEqual({ number: 42, action: 'merged' })
  expect(gitFromOutput('git log --oneline', '[main 1a2b3c4] x')).toBeUndefined()
  expect(gitFromOutput('git commit -m "push it"', 'nothing to commit, working tree clean')).toBeUndefined()
  expect(gitFromOutput('git push', 'Everything up-to-date')).toBeUndefined()
  expect(gitFromOutput('git merge feat', 'Already up to date.')).toBeUndefined()
})

test('verdict: exit codes, failure counts in output, and no verdict for refusals or backgrounded runs', () => {
  const base = { isError: false, errText: '', out: '', interrupted: false, backgrounded: false }
  expect(verdict('test', { ...base, out: 'Tests: 12 passed, 0 failed' })).toBe('pass')
  expect(verdict('test', { ...base, isError: true, errText: 'Exit code 1\nboom' })).toBe('fail')
  expect(verdict('test', { ...base, isError: true, errText: "The user doesn't want to proceed with this tool use." })).toBeUndefined()
  expect(verdict('test', { ...base, out: 'FAIL src/a.test.ts\nTests: 1 failed' })).toBe('fail')
  expect(verdict('test', { ...base, out: 'not ok 3 - adds' })).toBe('fail')
  expect(verdict('test', { ...base, backgrounded: true })).toBeUndefined()
  expect(verdict('test', { ...base, interrupted: true })).toBeUndefined()
  expect(verdict('type', { ...base, out: 'Found 3 errors.' })).toBe('fail')
  expect(verdict('lint', { ...base, out: '0 problems' })).toBe('pass')
  expect(verdict('test', { ...base, out: '1 error in setup (ignored)' })).toBe('pass')
})

test('oddityOf: the most specific flavour first; refusals are told apart', () => {
  expect(oddityOf('error: open(index.lock): File exists')?.id).toBe('odd-lokum')
  expect(oddityOf('CONFLICT (content): Merge conflict in a.ts')?.id).toBe('odd-crumble')
  expect(oddityOf("Error: listen EADDRINUSE: address already in use :::3000")?.id).toBe('odd-parfait')
  expect(oddityOf('bash: foo: command not found')).toEqual({ id: 'odd-crepe', match: 'command not found' })
  expect(oddityOf("ModuleNotFoundError: No module named 'x'")?.id).toBe('odd-macaron')
  expect(oddityOf("TypeError: Cannot read properties of undefined (reading 'a')")?.id).toBe('odd-nougat')
  expect(oddityOf('SyntaxError: Unexpected token }')?.id).toBe('odd-scone')
  expect(oddityOf('Segmentation fault (core dumped)')?.id).toBe('odd-souffle')
  expect(oddityOf('curl: (28) Operation timed out')?.id).toBe('odd-tart')
  expect(oddityOf('connect ECONNREFUSED 127.0.0.1:5432')?.id).toBe('odd-crumpet')
  expect(oddityOf('rm: cannot remove x: Permission denied')?.id).toBe('odd-pate')
  expect(oddityOf('File does not exist.')?.id).toBe('odd-eclair')
  expect(oddityOf('all good')).toBeUndefined()
  expect(isRefusal('The user doesn’t want to proceed with this tool use.')).toBe(true)
  expect(isRefusal('Permission to use Bash has been denied.')).toBe(true)
  expect(isRefusal('cat: x: Permission denied')).toBe(false)
})

test('sides: Windows and WSL paths, from either side of the bridge', () => {
  expect(sides('C:\\Users\\me\\x')).toEqual({ win: true, wsl: false })
  expect(sides('\\\\wsl.localhost\\Ubuntu\\home\\me')).toEqual({ win: false, wsl: true })
  expect(sides("MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -e bash -lc 'ls /mnt/c/Users'")).toEqual({ win: true, wsl: true })
  expect(sides('cd //wsl.localhost/Ubuntu/home/me && ls')).toEqual({ win: false, wsl: true })
  expect(sides('npm test')).toEqual({ win: false, wsl: false })
})

test('files: languages, test files, lines taken out', () => {
  expect(['a.tsx', 'b.PY', 'c.md', 'd.json', 'Makefile'].map(languageOf)).toEqual(['TypeScript', 'Python', undefined, undefined, undefined])
  expect(['src/a.test.ts', 'tests/helpers.py', 'pkg/x_test.go', 'test_a.py', 'src/latest.ts', 'contest.py'].map(isTestFile)).toEqual([
    true, true, true, true, false, false,
  ])
  expect(netRemoved({ gitDiff: { additions: 3, deletions: 110 } })).toBe(107)
  expect(netRemoved({ structuredPatch: [{ lines: ['-a', '-b', '+c', ' d'] }] })).toBe(1)
  expect(netRemoved({})).toBe(0)
  // the edit's own hunks win over a gitDiff that may hold the file's earlier changes
  expect(netRemoved({ structuredPatch: [{ lines: ['-a', '+b'] }], gitDiff: { additions: 0, deletions: 300 } })).toBe(0)
  expect(headTail(`${'a'.repeat(10)}END`, 4)).toBe('aaaa\naEND')
  expect(headTail('short', 4)).toBe('short')
})

test('task notifications', () => {
  const text = '<task-notification><task-id>w1</task-id><status>completed</status></task-notification>\n<task-notification><task-id>b2</task-id><status>failed</status></task-notification>'
  expect(parseNotifications(text)).toEqual([{ taskId: 'w1', status: 'completed' }, { taskId: 'b2', status: 'failed' }])
})

test('the calendar: offsets, workdays, best runs that step over days off', () => {
  expect(parseOffset('+10:00')).toBe(600)
  expect(parseOffset('-0530')).toBe(-330)
  expect(parseOffset('UTC+1')).toBe(60)
  expect(parseOffset('local')).toBe('local')
  expect(parseOffset('+99:00')).toBe('local')
  const t = Date.UTC(2026, 9, 28, 23, 30)
  expect(dayKey(t, 0)).toBe('2026-10-28')
  expect(dayKey(t, 60)).toBe('2026-10-29')
  expect(when(t, 0)).toBe('28 Oct 23:30')
  expect([...parseWorkdays('Mon,Tue,Wed,Thu,Fri')].sort()).toEqual([1, 2, 3, 4, 5])
  expect([...parseWorkdays('Fri-Mon')].sort()).toEqual([0, 1, 5, 6])
  expect([...parseWorkdays('sunday tuesday')].sort()).toEqual([0, 2])
  expect([...parseWorkdays('nonsense')].sort()).toEqual([1, 2, 3, 4, 5])
  const week = parseWorkdays('Mon-Fri')
  expect(bestRun(['2026-10-23', '2026-10-26', '2026-10-27'], week)).toBe(3) // Fri, (weekend), Mon, Tue
  expect(bestRun(['2026-10-26', '2026-10-28'], week)).toBe(1) // Tuesday unlit ends it
  expect(bestRun(['2026-10-24', '2026-10-26'], week)).toBe(2) // a Saturday that shipped counts
  expect(bestRun([], week)).toBe(0)
})

test('toasts and hints read well', () => {
  expect(toastText(['A'])).toBe('Badge unlocked: A')
  expect(toastText(['A', 'B', 'C'])).toBe('Badges unlocked: A, B and C')
  expect(toastText(['A', 'B', 'C', 'D', 'E'])).toBe('Badges unlocked: A, B and 3 more')
  expect(wrap2('Tests pass within 15 min of failing', 19)).toEqual(['Tests pass within', '15 min of failing'])
  expect(wrap2('An edit nets 100 lines out', 19)).toEqual(['An edit nets 100', 'lines out'])
  expect(wrap2('one two three four five six', 9)).toEqual(['one two', 'three…'])
  expect(wrap2('short', 19)).toEqual(['short'])
})

test('the art: plain SVG the desktop can draw, small, escaped, no filter, pattern, style or gradient', () => {
  const svgs: string[] = []
  for (const c of CHAPTERS) {
    const cells = BADGES.filter(b => b.chapter === c.id).map((b, i) => ({
      pin: pinMarkup(b.id, c.frame, c.enamel, (['earned', 'locked', 'hidden'] as const)[i % 3]!),
      name: b.short,
      lines: ['28 Oct'],
      tip: `${b.name} <&>`,
    }))
    svgs.push(pageSvg(cells, 6, c.name))
  }
  svgs.push(dropSvg(['first-stitch', 'ember'].map(id => pinMarkup(id, 'round', '#4a78b5', 'earned'))))
  svgs.push(plaqueSvg('Master of Small Things'))
  for (const svg of svgs) {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg.length).toBeLessThan(40_000)
    expect(svg).not.toMatch(/<(?:filter|pattern|style|script|linearGradient|radialGradient|foreignObject)\b|\son\w+=|\$[IDRG]/)
    expect((svg.match(/<g\b/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length)
  }
  expect(svgs[0]).toContain('&lt;&amp;&gt;')
  for (const b of BADGES) expect(pinMarkup(b.id, 'hex', '#348f94', 'earned').length, b.id).toBeLessThan(2_000)
  expect(shade('#ffffff', 0.5)).toBe('#808080')
  expect(plaqueSvg('A & B')).toContain('A &amp; B')
  // the sizes the band hands its Svg elements are the markup's own
  expect(dropSvg(['a', 'b'])).toContain(`width="${dropWidth(2)}" height="${DROP_H}"`)
  expect(plaqueSvg('x')).toContain(`width="${PLAQUE_W}" height="${PLAQUE_H}"`)
})
