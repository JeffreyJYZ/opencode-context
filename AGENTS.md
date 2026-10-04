# AGENTS.md

Repository: `@jeffreyjyz/opencode-context` — a provider-agnostic opencode plugin
that shows where a session's context window went, in the style of delta.app's
Context Window panel. Sits beside `cmduse`, `oc-cmd-compare` (`mpc`) and
`reqshape` in `~/dev/cmdcode-tools/`, but shares no code with them; unlike the
others it is not Command-Code-specific.

## Layout

```
src/index.ts      server half (v2 `{ id, setup }`): the `session.context` hook that
                  captures system-prompt/tool-definition sizes, plus the
                  `context_breakdown` tool
src/tui.tsx       TUI half (`./tui`): the `/context` slash command + dialog
src/breakdown.ts  pure: replayable messages -> buckets. The ONE classification point
src/collect.ts    TUI collector: session.context + model limit + agent system + capture
src/capture.ts    cross-process sizes cache ($XDG_CACHE_HOME/opencode-context/<session>.json)
src/dialog.tsx    the dialog JSX (flex layout, stacked bar, rows)
src/format.ts     bytes / tokens / percent
scripts/preview.tsx  headless frame preview: `bun run scripts/preview.tsx [width] [spans]`
index.js, tui.js  root shims for local-directory plugin loading (see Traps)
```

## Core rules

- **One classification point: `breakdown.ts`.** Both halves feed it the same
  shapes; never classify parts anywhere else, or the dialog and the tool will
  disagree.
- **The system prompt and tool definitions are not in the message store.** They
  are assembled per request in the server process. The server half measures them
  in the `session.context` hook and writes their *sizes only* to the capture file;
  the TUI dialog reads it. When the capture is missing (no request yet) the System
  Prompt row falls back to `AgentInfo.system` and Tool Definitions is hidden —
  never invent those numbers.
- **`session.context` is the replayable context, not the full history.** It is
  post-compaction and is exactly what the provider would receive. Read it via
  `ctx.client.session.context({ sessionID })` in the TUI and
  `ctx.session.context({ sessionID })` in the server so the breakdown describes
  the loaded window.
- **Bytes are UTF-8; tokens are a 4-chars/token estimate.** The header's
  `used / limit` is the provider's measured number (`tokens.input + output +
  reasoning + cache.read + cache.write` of the last assistant turn). Never
  present the per-row estimate as exact.
- **The two halves share nothing but the filesystem.** They run in different
  processes (the server half's state is not TUI-visible — the same reason the
  cmduse plugin's TUI spawns its CLI client-side). That is why the capture is a
  file and not, say, plugin storage.

## Traps

- **Local-directory plugins resolve `index` / `server` / `tui` beside the package
  root, not the `exports` map.** So the repo ships root `index.js` and `tui.js`
  shims that re-export `dist/`; npm installs use `exports` instead. Keep the shims
  in sync with what `dist/` produces.
- **`<span fg={…}>` is silently ignored; spans need `<span style={{ fg }}>`.**
  Pass colours per segment, not per text node.
- **A TUI app-slot `render` must return void, not `null`** — a `null` leaves an
  empty box that paints a stray line in the prompt area. `ctx.keymap.layer()` must
  be called inside a render, so the app slot mounts a no-op and registers there.
- **Custom dialog JSX works**: `ctx.ui.dialog.show(() => <X/>)` then
  `ctx.ui.dialog.set({ size: "large" })`. opencode's own diff-viewer does the
  same; it is not `alert()`-only.
- **A keymap command has no session prop.** The active session comes from
  `ctx.ui.router.current()` — handle `route.type === "session"`, else toast.
- **`model.list` returns `{ location, data }`**, not a bare array — read
  `.data`. `Tool.Context` gives tools `sessionID` (and `agent`); `AgentInfo`
  carries `system`.
- **`biome check .` aborts on a nested root configuration when a `.delta/`
  directory is present**; this repo's `biome.json` excludes `**/.delta`.
- **Build the TUI with `@opentui/solid`'s transform** (`scripts/build-tui.ts`),
  not a plain `bun build`: plain JSX evaluates props at element creation and the
  panel freezes at mount. `@opentui/*` and `solid-js` stay external because the
  host rewrites the entry's imports to its own module instances.
- **The dialog lays out with flexbox, not fixed-width strings.** Rows fill
  `width="100%"`, the label is a `flexGrow` spacer, and size/percent are fixed
  columns pushed right — a `padEnd`/`padStart` block (the first cut) floats or
  squishes because the dialog's inner width is not known to the render. The bar
  is a row of `flexGrow`-weighted boxes with `backgroundColor`, so it spans the
  dialog; a repeated glyph run cannot.
- **`captureCharFrame()` cannot show the bar's background colour** — the plain
  frame renders it as blanks. Use `captureSpans()` (sum `span.width`, count
  distinct `span.bg`) or `bun run scripts/preview.tsx <width> spans` to audit it;
  `test/dialog-render.test.tsx` is the guard.
- **An ASCII space inside a flex-row `<text>` can be painted/captured as a stray
  character.** Deliberately broken down: a row whose label immediately follows a
  bucket *with children* rendered `Thinking Blocks` as `ThinkingoBlocks` — the
  space took a glyph out of the same string, and the glyph changed with the text
  (`Think Blocks` → `ThinksBlocks`, two spaces → `on`). Replacing the label's
  spaces with **U+00A0** lays out identically and paints correctly, which is why
  `dialog.tsx` renders `label.replace(/ /g, "\u00a0")`; the render test
  normalises NBSP back to a space before asserting. A flat row list and a spacer
  box (instead of `flexGrow` on the label) did **not** fix it — only the NBSP did.
  Confirm any future row-layout change with `bun run scripts/preview.tsx`.

## Build & test

```sh
bun install
bun test          # breakdown + plugin-shape tests, hermetic
bun run typecheck
bun run build     # server bundle + solid-transformed tui + declarations
```

`dist/index.js` must import only node builtins at runtime (no `@opencode/*`), so
a fresh opencode start does not install the provider/effect graph before the
plugin appears. `@opencode/plugin` is a devDependency, type-only.

## Publishing (NEVER without explicit go)

Same policy as the sibling repos: local commits only until the user says push.
Publishing from this account must go through `npm stage publish` + the user's
`npm stage approve` — a bare `npm publish` leaves ghost versions (see
`cmduse/AGENTS.md` for the full trap). Version this package independently. After
a publish, opencode's per-package install cache can lag npm: `npm cache clean`,
remove `~/.cache/opencode/npm/@jeffreyjyz/opencode-context@latest`, then the user
restarts. **Never restart or reload opencode yourself.**

- **`npm stage publish` failing `E401 "authentication token seems to be invalid"`
  is a dead `~/.npmrc` token, not a staging problem.** Confirm with `npm whoami`
  (also 401). This account's stored token is being invalidated by npm's bypass-2FA
  restriction; the fix is interactive — the user runs `npm login` (browser), then
  re-stage. Do not try to log in from the agent shell, and do not paste or log the
  token (a failed attempt once leaked it into the transcript; rotate if that happens).
