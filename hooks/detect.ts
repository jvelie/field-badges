// field-badges: pure readers of what a tool call did. Which shell command is a test, type check or
// lint run and how it came out, which error flavour an error is, which side of the Windows/WSL
// bridge a path is on, and the calendar sums for Kindled Days. No imports, no I/O.

export type CheckKind = 'test' | 'type' | 'lint'
export type Check = { kind: CheckKind; label: string }

const TEST_RE =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b|npx\s+(?:jest|vitest|mocha|playwright\s+test)\b|pytest\b|python3?\s+-m\s+(?:pytest|unittest)\b|jest\b|vitest\b|mocha\b|go\s+test\b|cargo\s+(?:test|nextest)\b|dotnet\s+test\b|mvn\s+(?:\S+\s+)*?test\b|gradlew?\s+(?:\S+\s+)*?test\b|rspec\b|phpunit\b|ctest\b|deno\s+test\b|claude(?:\.exe)?\s+plugin\s+test\b|make\s+(?:test|check)\b|tox\b)|(?:^|[\s/'"])check\.sh\b/i
const TYPE_RE = /\b(?:vue-tsc|tsc|mypy|pyright|cargo\s+check|go\s+vet|(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:typecheck|type-check|tsc))\b/i
const LINT_RE =
  /\b(?:eslint|ruff(?:\s+check)?|flake8|pylint|cargo\s+clippy|golangci-lint|biome\s+(?:check|lint)|prettier\s+--check|shellcheck|stylelint|(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?lint)\b/i
/** Commit messages and here-documents are words about a tool, never a run of it. */
const MESSAGE_ARG = /\s(?:-m|--message)(?:\s+|=)(?:"(?:[^"\\]|\\.)*"|'[^']*')/g
const HEREDOC = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1[^\n]*\n[\s\S]*?\n[ \t]*\2(?=\s|$|\))/g
/** One part of a command line: between &&, ||, ;, |, & and line ends. */
const PARTS = /&&|\|\||[;|&\n]/
const LEADING = /^(?:[({]\s*)*(?:(?:[A-Za-z_]\w*=\S*|time|sudo|env|exec|nohup)\s+)*/
/**
 * A part that only reads about a tool (greps for it, prints it), commits or installs it runs
 * nothing: `npm install -D vitest` is no test run, nor is `git commit -m "fix pytest"`.
 */
const NOT_A_RUN =
  /^(?:grep|rg|cat|head|tail|less|echo|printf|which|type|where|ls|dir|cd|Get-Content|Select-String|Write-(?:Host|Output)|git|gh)\b|^(?:npm|pnpm|yarn|bun)\s+(?:i|install|add|remove|rm|uninstall|ci|update|upgrade|view|info|ls|list|outdated)\b|^(?:pip3?|pipx|uv\s+pip|poetry|cargo|go|brew|apt(?:-get)?|winget|choco|dotnet)\s+(?:install|add|get|remove|uninstall)\b|^python3?\s+-m\s+pip\b/i
const HELP = /\s(?:--help|-h|--version|-V)\b/

/** Which kind of check a shell command runs, and the words that named it ("npm test"). */
export function classifyCheck(command: string): Check | undefined {
  const parts = command.replace(HEREDOC, ' ').replace(MESSAGE_ARG, ' ').split(PARTS)
  for (const raw of parts) {
    const part = raw.trim().replace(LEADING, '')
    if (!part || NOT_A_RUN.test(part) || HELP.test(part)) continue
    for (const [kind, re] of [['test', TEST_RE], ['type', TYPE_RE], ['lint', LINT_RE]] as const) {
      const m = re.exec(part)
      if (m) return { kind, label: m[0].trim().replace(/^['"/]+/, '').slice(0, 40) }
    }
  }
  return undefined
}

/** The head and tail of a long text, where an error's own words usually are. */
export const headTail = (text: string, n: number): string => (text.length > 2 * n ? `${text.slice(0, n)}\n${text.slice(-n)}` : text)

/** The engine's git record, as `gitOperation` spells it (the parts this mod reads). */
export type GitOp = {
  commit?: { sha: string; kind: 'committed' | 'amended' | 'cherry-picked'; branch?: string }
  push?: { branch: string }
  branch?: { ref: string; action: 'merged' | 'rebased' }
  pr?: { number: number; action: 'created' | 'merged' }
}

const gitVerb = (verbs: string): RegExp => new RegExp(`\\bgit\\b[^\\n;&|]*?\\s(?:${verbs})\\b`)
const COMMIT_LINE = /^\[(.+?) ([0-9a-f]{7,40})\] /m
const PUSH_LINE = /^\s*[+*-]?\s*(?:[0-9a-f]{7,40}\.\.\.?[0-9a-f]{7,40}|\[new branch\])\s+\S+\s+->\s+(\S+)/m
const REBASED = /Successfully rebased and updated (?:refs\/heads\/)?(\S+?)\.?\s*$/m
const MERGED = /^(?:Merge made by\b|Fast-forward\s*$)/m
const PR_URL = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/(\d+)/
const PR_MERGED = /\bmerged pull request\s+(?:[\w.-]+\/[\w.-]+)?#(\d+)/i

/**
 * What git did, read from the command and what it printed, for a call the engine left without a
 * `gitOperation` (a git run wrapped in another shell, e.g. `wsl.exe ... bash -lc '...'` or `ssh host`). Both must agree: the verb in
 * the command and git's own line in the output.
 */
export function gitFromOutput(full: string, out: string): GitOp | undefined {
  const command = full.replace(HEREDOC, ' ').replace(MESSAGE_ARG, ' ')
  const op: GitOp = {}
  const commit = gitVerb('commit|cherry-pick').test(command) ? COMMIT_LINE.exec(out) : null
  if (commit) {
    const where = commit[1]!.replace(/\s*\(root-commit\)$/, '')
    const kind = /\scherry-pick\b/.test(command) ? 'cherry-picked' : /\s--amend\b/.test(command) ? 'amended' : 'committed'
    op.commit = { sha: commit[2]!, kind, ...(where && !/^detached\b/.test(where) ? { branch: where } : {}) }
  }
  const push = gitVerb('push').test(command) ? PUSH_LINE.exec(out) : null
  if (push) op.push = { branch: push[1]! }
  const rebased = gitVerb('rebase').test(command) ? REBASED.exec(out) : null
  if (rebased) op.branch = { ref: rebased[1]!, action: 'rebased' }
  else if (gitVerb('merge').test(command) && MERGED.test(out)) {
    const ref = /\bgit\b[^\n;&|]*?\smerge\s+(?:-{1,2}\S+\s+)*([^\s'"-][^\s'"]*)/.exec(command)?.[1]
    op.branch = { ref: ref ?? '', action: 'merged' }
  }
  const created = /\bgh\s+pr\s+create\b/.test(command) ? PR_URL.exec(out) : null
  const merged = /\bgh\s+pr\s+merge\b/.test(command) ? PR_MERGED.exec(out) : null
  if (created) op.pr = { number: Number(created[1]), action: 'created' }
  else if (merged) op.pr = { number: Number(merged[1]), action: 'merged' }
  return Object.keys(op).length ? op : undefined
}

/** The engine's text for a failed shell call starts with its exit code; a refusal never does. */
export const EXIT_RE = /\bexit(?:ed with)?\s+code:?\s*[1-9]\d*/i
const FAIL_LINE = /(?:^|\n)\s*(?:FAIL|FAILED|not ok)\b/
const FAIL_COUNT = /\b[1-9]\d*\s+(?:failed|failing|failures?)\b|\bfailures?:\s*[1-9]/i
const ERROR_COUNT = /\b[1-9]\d*\s+(?:errors?|problems?)\b|\berror\s+TS\d{4}\b/i

export type Outcome = {
  isError: boolean
  /** The error as the model read it, its head. */
  errText: string
  /** The tail of stdout and stderr on an answered call. */
  out: string
  interrupted: boolean
  /** Moved to the background (asked, or past its timeout): no verdict yet. */
  backgrounded: boolean
}

/**
 * How a check came out: `fail` on a non-zero exit, or output that counts failures (a run piped
 * through `tail` exits 0); `pass` on a clean answer; undefined when it never ran to a verdict
 * (a refusal at the permission card, an interrupt, a run moved to the background).
 */
export function verdict(kind: CheckKind, o: Outcome): 'pass' | 'fail' | undefined {
  if (o.isError) return EXIT_RE.test(o.errText.slice(0, 300)) ? 'fail' : undefined
  if (o.interrupted || o.backgrounded) return undefined
  if (FAIL_LINE.test(o.out) || FAIL_COUNT.test(o.out)) return 'fail'
  if (kind !== 'test' && ERROR_COUNT.test(o.out)) return 'fail'
  return 'pass'
}

/** A refusal at the permission card, an interrupt, or a hook's block: never an error flavour. */
const REFUSAL_RE =
  /doesn[’']t want to (?:proceed|take this action)|tool use was rejected|(?:rejected|denied|declined) by the user|user (?:rejected|denied|declined)|Permission to use .{1,80} (?:has been|was) denied|interrupted by user|\[Request interrupted|blocked by (?:a )?hook/i
export const isRefusal = (text: string): boolean => REFUSAL_RE.test(text)

/** The error flavours, most specific first: each badge id with what tastes of it. */
export const ODDITIES: readonly (readonly [string, RegExp])[] = [
  ['odd-crumble', /CONFLICT \(|merge conflict|Automatic merge failed|unmerged files/i],
  ['odd-lokum', /index\.lock|\.lock'?:? File exists|could not (?:obtain|acquire) (?:a )?lock|database is locked|\bEBUSY\b/i],
  ['odd-parfait', /\bEADDRINUSE\b|address already in use|port \d+ is (?:already )?in use/i],
  ['odd-crumpet', /\bECONNREFUSED\b|Connection refused|\bECONNRESET\b|connection reset by peer/i],
  ['odd-tart', /\bETIMEDOUT\b|timed out|Timeout (?:of \d+ ?ms )?exceeded/i],
  ['odd-souffle', /Segmentation fault|\bSIGSEGV\b|core dumped/i],
  ['odd-macaron', /Cannot find module|ModuleNotFoundError|No module named|ERR_MODULE_NOT_FOUND|Could not resolve (?:import|dependency)/i],
  ['odd-crepe', /command not found|is not recognized as (?:an internal or external command|the name of a cmdlet)|CommandNotFoundException/i],
  ['odd-nougat', /NullPointerException|NullReferenceException|Cannot read propert(?:y|ies) of (?:undefined|null)|'NoneType' object|null pointer/i],
  ['odd-scone', /SyntaxError|syntax error|Unexpected token|ParseError|unexpected EOF/i],
  ['odd-pate', /Permission denied|\bEACCES\b|\bEPERM\b|Access is denied|Access to the path .{1,200}? is denied|UnauthorizedAccess/i],
  ['odd-eclair', /\bENOENT\b|No such file or directory|does not exist|cannot find (?:the )?(?:path|file)|FileNotFoundError/i],
]

/** The first error flavour the text tastes of: its badge id and the words that matched. */
export function oddityOf(text: string): { id: string; match: string } | undefined {
  for (const [id, re] of ODDITIES) {
    const m = re.exec(text)
    if (m) return { id, match: m[0].trim().slice(0, 60) }
  }
  return undefined
}

const WIN_SIDE = /(?:^|[\s'"`(=:,;])[A-Za-z]:[\\/]|(?:^|[\s'"`(=])\/mnt\/[a-z]\/|%(?:TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE)%|\$env:/i
const WSL_SIDE = /\\\\wsl(?:\.localhost|\$)\\|\/\/wsl(?:\.localhost|\$)\/|(?:^|[\s'"`(;&|])wsl(?:\.exe)?\s|(?:^|[\s'"`(=:])\/home\/[^/\s'"`]+/i

/** Which sides of the Windows/WSL bridge a path or a command line touches. */
export function sides(text: string): { win: boolean; wsl: boolean } {
  return { win: WIN_SIDE.test(text), wsl: WSL_SIDE.test(text) }
}

export const baseName = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? path

const LANGS: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', kt: 'Kotlin', swift: 'Swift',
  c: 'C', h: 'C', cpp: 'C++', cc: 'C++', cxx: 'C++', hpp: 'C++', cs: 'C#', rb: 'Ruby', php: 'PHP',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell', ps1: 'PowerShell', psm1: 'PowerShell', lua: 'Lua', sql: 'SQL',
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'CSS', sass: 'CSS', less: 'CSS', vue: 'Vue', svelte: 'Svelte',
  dart: 'Dart', scala: 'Scala', r: 'R', jl: 'Julia', ex: 'Elixir', exs: 'Elixir', hs: 'Haskell', ml: 'OCaml',
  zig: 'Zig', nim: 'Nim', ipynb: 'Python',
}

/** The programming language a file is in, by its extension; undefined for docs and config. */
export function languageOf(path: string): string | undefined {
  const m = /\.([A-Za-z0-9]+)$/.exec(baseName(path))
  return m ? LANGS[m[1]!.toLowerCase()] : undefined
}

const TEST_FILE =
  /(?:^|[\\/])(?:test_[^\\/]*\.py|[^\\/]+[._](?:test|spec)\.[A-Za-z0-9]+|[^\\/]+_test\.(?:go|py|rs|rb|exs))$|(?:^|[\\/])(?:tests?|__tests__|spec)[\\/][^\\/]+\.[A-Za-z0-9]+$/i
export const isTestFile = (path: string): boolean => TEST_FILE.test(path)

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * Lines an Edit or Write took out beyond those it put in: its own patch hunks, else (no hunks: a
 * diff that timed out) its gitDiff, which may count the file's earlier uncommitted changes too.
 */
export function netRemoved(rec: Record<string, unknown>): number {
  let out = 0
  let isSeen = false
  if (Array.isArray(rec.structuredPatch)) {
    for (const hunk of rec.structuredPatch) {
      if (!isObj(hunk) || !Array.isArray(hunk.lines)) continue
      isSeen = true
      for (const line of hunk.lines) {
        if (typeof line !== 'string') continue
        if (line.startsWith('-')) out++
        else if (line.startsWith('+')) out--
      }
    }
  }
  if (isSeen) return out
  const diff = rec.gitDiff
  if (isObj(diff) && typeof diff.additions === 'number' && typeof diff.deletions === 'number') return diff.deletions - diff.additions
  return 0
}

export type Notice = { taskId: string; status: string }

/** Every <task-notification> block of a prompt: its task id and status. */
export function parseNotifications(text: string): Notice[] {
  const out: Notice[] = []
  for (const chunk of text.split('<task-notification>').slice(1)) {
    const id = /<task-id>([^<]+)<\/task-id>/.exec(chunk)?.[1]?.trim()
    const status = /<status>([^<]+)<\/status>/.exec(chunk)?.[1]?.trim()
    if (id && status) out.push({ taskId: id, status })
  }
  return out
}

// ---- the calendar ------------------------------------------------------------------------------

/** 'local' reads the clock the hooks see; a number is a fixed offset from UTC in minutes. */
export type Offset = number | 'local'

export function parseOffset(value: unknown): Offset {
  if (typeof value !== 'string') return 'local'
  const m = /^\s*(?:UTC|GMT)?\s*([+-])(\d{1,2})(?::?(\d{2}))?\s*$/i.exec(value)
  if (!m) return 'local'
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0)
  return minutes > 14 * 60 ? 'local' : (m[1] === '-' ? -1 : 1) * minutes
}

export type Parts = { y: number; mo: number; d: number; wd: number; h: number; mi: number }

export function parts(ms: number, off: Offset): Parts {
  if (off === 'local') {
    const t = new Date(ms)
    return { y: t.getFullYear(), mo: t.getMonth(), d: t.getDate(), wd: t.getDay(), h: t.getHours(), mi: t.getMinutes() }
  }
  const t = new Date(ms + off * 60_000)
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate(), wd: t.getUTCDay(), h: t.getUTCHours(), mi: t.getUTCMinutes() }
}

const pad = (n: number): string => String(n).padStart(2, '0')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The calendar day, 'YYYY-MM-DD'. */
export function dayKey(ms: number, off: Offset): string {
  const p = parts(ms, off)
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}`
}

/** '28 Oct 14:12' */
export function when(ms: number, off: Offset): string {
  const p = parts(ms, off)
  return `${p.d} ${MONTHS[p.mo]} ${pad(p.h)}:${pad(p.mi)}`
}

/** '28 Oct' */
export function shortDay(ms: number, off: Offset): string {
  const p = parts(ms, off)
  return `${p.d} ${MONTHS[p.mo]}`
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const DEFAULT_WORKDAYS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5])

/** "Mon,Tue,Wed" or "Mon-Fri" (names or 0-6, Sunday 0) to weekday numbers; the default if none read. */
export function parseWorkdays(value: unknown): ReadonlySet<number> {
  if (typeof value !== 'string') return DEFAULT_WORKDAYS
  const day = (s: string): number | undefined => {
    const t = s.trim().toLowerCase()
    if (/^[0-6]$/.test(t)) return Number(t)
    const i = DAY_NAMES.indexOf(t.slice(0, 3))
    return t.length >= 2 && i >= 0 ? i : undefined
  }
  const out = new Set<number>()
  for (const part of value.split(/[,;\s]+/).filter(Boolean)) {
    const range = /^(.+?)-(.+)$/.exec(part)
    if (range) {
      const a = day(range[1]!)
      const z = day(range[2]!)
      if (a === undefined || z === undefined) continue
      for (let i = a; ; i = (i + 1) % 7) {
        out.add(i)
        if (i === z || out.size === 7) break
      }
    } else {
      const d = day(part)
      if (d !== undefined) out.add(d)
    }
  }
  return out.size ? out : DEFAULT_WORKDAYS
}

const weekdayOfKey = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()
}

/**
 * The longest run of kindled days, counting each kindled day; a day off (not a workday) that was
 * not kindled steps over without breaking the run; a workday that was not kindled ends it.
 */
export function bestRun(days: Iterable<string>, workdays: ReadonlySet<number>): number {
  const set = new Set([...days].filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)))
  if (set.size === 0) return 0
  const sorted = [...set].sort()
  const toMs = (k: string): number => {
    const [y, m, d] = k.split('-').map(Number)
    return Date.UTC(y!, m! - 1, d!)
  }
  const last = toMs(sorted[sorted.length - 1]!)
  let run = 0
  let best = 0
  for (let t = toMs(sorted[0]!); t <= last; t += 86_400_000) {
    const k = new Date(t).toISOString().slice(0, 10)
    if (set.has(k)) best = Math.max(best, ++run)
    else if (workdays.has(weekdayOfKey(k))) run = 0
  }
  return best
}

/** One toast for the unlocks that arrived together. */
export function toastText(names: readonly string[]): string {
  if (names.length <= 1) return `Badge unlocked: ${names[0] ?? ''}`
  if (names.length <= 3) return `Badges unlocked: ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `Badges unlocked: ${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

/** Two lines of at most `width` characters, words kept whole where they fit. */
export function wrap2(text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  let isCut = false
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (lines.length === 2) {
      isCut = true
      break
    }
    if (!line) line = word
    else if (line.length + 1 + word.length <= width) line += ' ' + word
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) {
    if (lines.length < 2) lines.push(line)
    else isCut = true
  }
  const out = lines.map(l => (l.length > width ? l.slice(0, width - 1) + '…' : l))
  if (isCut && out.length) out[out.length - 1] = out[out.length - 1]!.slice(0, width - 1).replace(/…$/, '') + '…'
  return out
}
