# Virtual Select Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all Sound candidates on open, add Yamada UI Select-like scale/fade motion to both virtual selectors, and lower both carets to 2px.

**Architecture:** Separate Sound's displayed input value from its filter query, mirroring Version. Wrap each existing popup shell with Yamada UI `ScaleFade`, which already implements the Select/Popover 0.95 scale and fade presence lifecycle while leaving each `react-window` list unchanged.

**Tech Stack:** React 18, TypeScript, Yamada UI 1.7.2, react-window, jsdom self-checks.

## Global Constraints

- Work in the current `dev` checkout; do not create a worktree.
- Preserve all changes from the first virtual-autocomplete implementation.
- Preserve both virtual lists, fixed 36px rows, Version width/status/download behavior, and Sound focus requests.
- Do not touch the user's untracked `.claude/`.

### Task 1: Reproduce Sound filtering and shared visual requirements

**Files:**
- Modify: `src/web/components/virtualSelectDropdowns.dom.selfcheck.tsx`
- Modify: `src/web/components/virtualSelectDropdowns.selfcheck.tsx`

- [ ] Add a DOM assertion that opening Sound with a committed ID renders all three options before typing.
- [ ] Add the same assertion after a focus-request open.
- [ ] Assert typing `bell` still reduces the list to one option.
- [ ] Assert `virtualSelectTriggerProps.paddingTop === '2px'`.
- [ ] Render each selector open and assert its popup uses Yamada ScaleFade markup with transform origin at the top.
- [ ] Run `npm.cmd run selfcheck` and observe RED because Sound currently filters by the committed ID and padding is 1px.

### Task 2: Separate Sound display and query state

**Files:**
- Modify: `src/web/Sub/components/AudioSelectDropdown.tsx`

- [ ] Add `query` state initialized to an empty string.
- [ ] Filter options with `query`, not `inputValue`.
- [ ] On normal open and focus-request open, display the committed value but reset `query` to empty.
- [ ] On typing, update both `inputValue` and `query`.
- [ ] On clear and select, reset `query` alongside current input behavior.
- [ ] Run `npm.cmd run selfcheck`; Sound assertions pass while animation/padding assertions remain RED.

### Task 3: Add shared Select-like motion and caret alignment

**Files:**
- Modify: `src/web/components/virtualSelectStyles.ts`
- Modify: `src/web/Main/VersionSelector.tsx`
- Modify: `src/web/Sub/components/AudioSelectDropdown.tsx`

- [ ] Change shared trigger `paddingTop` from `1px` to `2px`.
- [ ] Export shared popup motion props: `duration: 0.2`, `scale: 0.95`, `transformOrigin: 'top center'`.
- [ ] Import `ScaleFade` from `@yamada-ui/react` in both selectors.
- [ ] Replace immediate conditional popup mounting with `<ScaleFade open={popupVisible} unmountOnExit ...>`.
- [ ] Apply `aria-hidden={!popupVisible}` and `pointerEvents={popupVisible ? 'auto' : 'none'}` so an exiting popup is non-interactive.
- [ ] Keep list sizing, item counts, refs, overscan, roles, and IDs unchanged.
- [ ] Run `npm.cmd run selfcheck` and observe GREEN.

### Task 4: Verify

- [ ] Run `npm.cmd run selfcheck`.
- [ ] Run `npx.cmd tsc --noEmit`.
- [ ] Run focused ESLint for both selectors, shared styles, and both self-checks.
- [ ] Run `npm.cmd run build`.
- [ ] Run `git diff --check`.
- [ ] Inspect the diff and confirm both `FixedSizeList` imports, row height 36, Version width 14rem/status icon, and Sound focus-request handling remain.

