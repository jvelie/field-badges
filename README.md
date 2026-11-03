# field-badges

Forty-four hand-drawn pin badges for memorable moments of real work (a rebase that went through, tests gone green within 15 minutes of failing, a workflow back home), each earned once ever and kept in a badge book beside the chat.
Every few badges you climb an original ladder of twelve workshop titles, shown on a brass plaque at most once a day. It is for looks only: nothing it does reaches the model, and it costs no tokens.

A Claude Code mod (a plugin with a hooks module). It needs a Claude Code recent enough to run mods; it was built and tested on 2.1.309, in the Desktop app's Code tab and in the terminal.

## Install

In the Desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `jvelie/field-badges`, then **Add plugin**.

At the prompt of a terminal session:

```
/plugin install field-badges --marketplace jvelie/field-badges
```

From a shell:

```bash
claude plugin install field-badges --marketplace jvelie/field-badges
```

Answer `y` to add the marketplace, then pick the user scope. Start a new session afterwards.

## Try it

1. Start a new session on a workday (Monday to Friday by default) and ask anything. When the first answer lands you get **Clocked In**:
   - a toast for 5 s: `Badge unlocked: Clocked In`;
   - in the band above the prompt, the pin drops in and bounces once, next to a brass plaque reading **Apprentice** (8 s);
   - on the Desktop, a small 🏅 at the right end of the footer under the prompt.
2. Click the 🏅, or type `/badges`. The badge book opens in a pane: one parchment page of pins per chapter (earned pins in full enamel with name and date, locked ones as grey silhouettes with a hint, hidden ones as `?`), your title and the next one, Kindled Days, and a story line for each badge (`3 Mar 09:15  Clocked In, in my-app: first answer of a Tuesday`).
3. Earn a few more on purpose. Each of these is one prompt:
   - "Run the tests" in a repo with a failing test, then "fix it and rerun": **First Light**, then **Red to Green**.
   - "Commit this": **First Stitch**, plus **First Ember** (the first Kindled Day).
   - "Read a file that does not exist (nope.txt)": the Oddity **ENOENT Éclair**.
   - "Use five Explore agents to survey this repo": **First Mate**, **Lookout**, **Conductor**.
   - Badges that arrive together share one toast; after a toast the next waits at least 5 minutes.
4. To test Hush: open the book and press **Hush unlocks**. Later unlocks still count and show in the book, with no toast, pin drop or plaque.

## The footer icon

On the Desktop the badge book lives in the footer under the prompt, at its right end, after whatever else is drawn there and before the app's own model label: one small 🏅, nothing else. Pressing it opens the badge book, as `/badges` does. The Desktop shows a button's label as its face, so the label is the icon alone (`footerIcon` changes it, for example to `◆`).

```text
<mode labels>                                          🏅   <model>
```

The band above the prompt only shows the pin drop and the plaque for a few seconds after an unlock; otherwise it is left exactly as the engine and other mods draw it.

The terminal shows a `◆ n` label among the footer's mode labels instead (`footerLabel`), and `/badges` opens a text book.

## The badges

| Chapter | Badges (hidden ones in italics) |
| --- | --- |
| Git | First Stitch (first commit), Sent Off (a push), Ribbon Cut (open a pull request), Bridge Builder (a pull request merged), Untangler (a rebase went through), Knot Tied (a branch merge), Second Draft (an amended commit), *Cherry Picker* |
| Tests | First Light (a test run passes), Red to Green (passes within 15 min of failing), True Square (type check clean after failing), Smooth Plane (lint clean after failing), Fresh Gauge (a new test file) |
| Workflows | Shipwright (launch a workflow), Fleet Return (a workflow run finishes), *Long Voyage*, Hands Free (a background command finishes) |
| Endurance | Clocked In (first answer of a workday), Long Haul (a 30-minute turn ends in an answer), *Second Wind*, Clean Sweep (8+ to-dos, all done) |
| Crew | First Mate (a helper agent), Lookout (an Explore agent), Conductor (five helpers in one turn) |
| Craft | Blank Page (a new file), Lean Cut (an edit nets 100 lines out), *Bridgewalker* (for Windows + WSL setups), *Polyglot* |
| Oddities | Twelve error flavours, each discovered once ever: Permission Denied Pâté, ENOENT Éclair, Merge-Conflict Crumble, Timeout Tart, Segfault Soufflé, Syntax Error Scone, Null Pointer Nougat, Port-in-Use Parfait, Command-Not-Found Crêpe, Missing Module Macaron, Connection Refused Crumpet, Lockfile Lokum. All hidden until tasted. |
| Kindled Days | First Ember (a day something shipped: a commit, a push, a pull request opened or merged), Three Coals and Steady Flame (best runs of 3 and 5 kindled workdays; a day off never breaks a run), Banked Fire (20 kindled days). There is no unlit state, no countdown and no reminder. |

Titles: Apprentice (1), Tinkerer (3), Wrenchhand (5), Fitter (8), Journeyer (11), Lathe-wise (14), Joiner (17), Artificer (21), Draftmaster (25), Keystone (30), Master of Small Things (35), Old Hand (40). A title reached on a day whose plaque was already shown gets its plaque on the next day it earns or answers.

No badge rewards long hours, late nights or line counts. A call refused at the permission card, an interrupt or a hook's block never counts as a failure or an error flavour. Only a run counts as a test, type check or lint run: installing a tool (`npm install -D vitest`), grepping or echoing its name, or naming it in a commit message does not. Lean Cut counts the edit's own lines, not the file's whole uncommitted diff. Subagents' work counts for git, tests, edits and oddities; the per-turn badges (Conductor, Bridgewalker, Polyglot, Clocked In, Long Haul, Second Wind) count the main conversation only.

## Options

Set them under `pluginConfigs.field-badges.options` in `~/.claude/settings.json` (on Windows `%USERPROFILE%\.claude\settings.json`), or in `/config` where the app shows them. A change reloads the mod.

| Option | Default | Meaning |
| --- | --- | --- |
| `badges` | `true` | Master switch. Off: nothing is recorded or drawn and `/badges` is not registered. Earned badges stay stored. |
| `toasts` | `true` | The 5 s unlock toast (merged, at most one per 5 minutes). |
| `pinDrops` | `true` | The pin drop (5 s) and title plaque (8 s, once a day at most) in the band. |
| `footerButton` | `true` | Desktop: the small pressable icon at the right end of the prompt footer that opens the badge book. Off: the Desktop footer shows the `footerLabel` instead. |
| `footerIcon` | `🏅` | The one character that icon shows; for example `◆` for a quieter diamond. |
| `footerLabel` | `true` | The `◆ n` footer label among the mode labels: on the terminal, and on the Desktop only while `footerButton` is off. |
| `command` | `true` | Register `/badges`. |
| `hiddenHints` | `false` | Show hidden badges and Oddities as silhouettes with hints instead of `?`. |
| `oddities` | `true` | The Oddities chapter. |
| `kindledDays` | `true` | The Kindled Days chapter (no days recorded while off). |
| `quiet` | `false` | No toasts, pin drops or plaques; badges still count. The book's Hush button does the same without a reload. |
| `workdays` | `Mon,Tue,Wed,Thu,Fri` | Days Clocked In counts and Kindled Days runs step over (names, `Mon-Fri` ranges, or 0-6). |
| `utcOffset` | `local` | `local` uses the hooks' clock; `+01:00` or `-05:00` fixes the day and time used for dates, workdays and Kindled Days. |

Example, quiet with hints:

```json
"pluginConfigs": { "field-badges": { "options": { "quiet": true, "hiddenHints": true } } }
```

## Switching it off

- For good: uninstall it (`/plugin`, or the Desktop's **+** → **Plugins**), then start a new session.
- Keep it installed but inert: `"pluginConfigs": { "field-badges": { "options": { "badges": false } } }`.
- Keep counting but stop the show: `quiet: true`, or Hush in the book.

Earned badges live in the mod's own store (one key per badge, per kindled day) on your machine, so they come back if you switch it on again.

## What it never does

No prompt section, no context on a tool result or prompt, no tool call refused or rewritten, no model call, no status line, no `holdToasts` pane, no sound, no process spawn, no file read, no network. Every observer awaits `next(e)` and does its work on a 1 ms timer afterwards, failing open. Its band and footer drawings include what the engine and other plugins drew there. The only model-visible trace is the typed `/badges` line if you use the command (its reply is empty); the footer icon costs nothing.

## Known limitations

- **The band.** Whether the pin drop's and plaque's shine animate depends on the surface running SMIL in its frame; without it they simply appear.
- **The book.** Pages assume about 8 CSS px per column (2 to 8 pins across) and scale down to the pane.
- **Test verdicts and Oddities** rely on a failed shell call's error text starting `Exit code N` (the Bash tool's wording; other shells' wording may differ).
- **Git badges** rely on the engine's git record. Where a call has none (git run through another shell, such as `wsl.exe ... bash -lc '...'` or `ssh host`), the mod reads git's own lines instead: the command must name the verb (`git commit`, `git push`, `git rebase`, `git merge`, `gh pr create`, `gh pr merge`) and the output must hold git's answer. A git call that exits non-zero earns nothing either way.
- **Time zone.** If dates come out shifted, set `utcOffset`.
- **Hot reload** drops timers: a pin drop left up by a reloaded module comes down at the next turn's start or end, and a waiting toast is forgotten.
- **Two sessions at once** keep their badges apart safely (one store key each); the 5-minute toast gap is shared, last write wins.

## Files

- `hooks/register.tsx`: the hooks (observers, the band, the footer icon and label, the book pane, `/badges`).
- `hooks/badges.ts`: the catalog (chapters, badges, titles), pure data.
- `hooks/detect.ts`: pure readers (which command is a test, type check or lint run and how it came out, git's own lines where the engine left no record, error flavours, Windows/WSL paths, the calendar).
- `hooks/art.ts`: the SVG art (three pin frames, 44 glyphs, the parchment page, the drop, the plaque), pure functions with no imports.
- `types/index.d.ts`: the `$.state` values the drawings read.
- `tests/`: `claude plugin test .` runs them (terminal and desktop).
- `.claude-plugin/marketplace.json`: makes this repository installable with the lines above.

## License

MIT. See `LICENSE`.
