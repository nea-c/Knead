# Virtual Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Main Version selector and Sub Sound selector Yamada UI Autocomplete-style clear and empty states without replacing their existing virtual lists.

**Architecture:** Keep `VirtualVersionSelect` and `AudioSelectDropdown` stateful and independent, and extend their shared presentation contract in `virtualSelectStyles.ts`. Popup visibility is based on whether the source has candidates, while filtered result count determines whether the popup renders `react-window` or a localized empty state.

**Tech Stack:** React 18, TypeScript, Yamada UI 1.7.2, react-window 1.8.11, react-i18next, jsdom self-checks.

## Global Constraints

- Preserve both existing `react-window` virtual lists and fixed row height `36`.
- Preserve Version width `14rem`, Sound surrounding layout, Version grouping/status/download behavior, Sound focus requests, selection callbacks, and ordering.
- Preserve outside-click closing, ArrowUp/ArrowDown/Enter/Escape behavior, and combobox/listbox ARIA.
- Clear only transient search text; never call `onChange` or `onSelect` from the clear button.
- Support existing light and dark themes and Japanese/English locales.
- Do not modify `src/web/Main/SoundSelector.tsx`.

---

### Task 1: Specify clear and empty-state behavior

**Files:**
- Modify: `src/web/components/virtualSelectDropdowns.dom.selfcheck.tsx`
- Modify: `src/web/components/virtualSelectDropdowns.selfcheck.tsx`

**Interfaces:**
- Consumes: `VirtualVersionSelect`, `AudioSelectDropdown`, `isVirtualSelectPopupVisible(open, sourceItemCount)`.
- Produces: failing DOM assertions for `data-virtual-select-clear`, `data-virtual-select-empty`, preserved callbacks, and restored candidates.

- [ ] **Step 1: Write failing DOM tests for Version**

After opening and typing `missing`, assert the popup remains expanded, the empty status exists, no options exist, and the clear control replaces the chevron. Click clear and assert three options return, the input becomes empty, the popup stays expanded, and the captured `selected` value remains unchanged:

```tsx
input(combobox, 'missing')
assert.equal(combobox.getAttribute('aria-expanded'), 'true')
assert.ok(mounted.container.querySelector('[data-virtual-select-empty]'))
assert.equal(mounted.container.querySelectorAll('[role="option"]').length, 0)
const clear = mounted.container.querySelector('[data-virtual-select-clear]')
assert.ok(clear)
click(clear)
assert.equal(combobox.value, '')
assert.equal(combobox.getAttribute('aria-expanded'), 'true')
assert.equal(mounted.container.querySelectorAll('[role="option"]').length, 3)
assert.equal(selected, '')
```

- [ ] **Step 2: Write failing DOM tests for Sound**

Before the first Sound selection, type `missing`, assert the same empty/clear contract, click clear, and assert all three options return and `selections` is still empty. Also assert an opened empty query contains the chevron and no clear button.

- [ ] **Step 3: Extend static style assertions**

Import `virtualSelectClearButtonProps` and `virtualSelectEmptyProps`, then assert:

```tsx
assert.equal(virtualSelectClearButtonProps.rounded, 'sm')
assert.equal(virtualSelectEmptyProps.color, 'muted')
assert.equal(virtualSelectEmptyProps.minH, VIRTUAL_SELECT_ITEM_HEIGHT)
assert.equal(isVirtualSelectPopupVisible(true, 0), false)
assert.equal(isVirtualSelectPopupVisible(true, 3), true)
```

- [ ] **Step 4: Run the self-check and verify RED**

Run: `npm run selfcheck`

Expected: FAIL because a filtered result count of zero currently closes the popup and neither clear nor empty-state markup exists.

- [ ] **Step 5: Commit the RED tests**

```powershell
git add -- src/web/components/virtualSelectDropdowns.dom.selfcheck.tsx src/web/components/virtualSelectDropdowns.selfcheck.tsx
git commit -m "test: specify virtual autocomplete states"
```

### Task 2: Add shared Autocomplete presentation and localization

**Files:**
- Modify: `src/web/components/virtualSelectStyles.ts`
- Modify: `src/web/i18n/locales/ja.json`
- Modify: `src/web/i18n/locales/en.json`

**Interfaces:**
- Produces: `virtualSelectClearButtonProps: BoxProps`, `virtualSelectEmptyProps: BoxProps`.
- Produces locale keys `virtual_select_clear` and `virtual_select_no_results`.

- [ ] **Step 1: Add the shared clear-control style**

```tsx
export const virtualSelectClearButtonProps = {
  alignItems: 'center',
  bg: 'transparent',
  color: ['blackAlpha.600', 'whiteAlpha.700'],
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'center',
  minH: '7',
  minW: '7',
  p: '1',
  rounded: 'sm',
  _hover: { bg: ['blackAlpha.100', 'whiteAlpha.100'] },
  _focusVisible: { boxShadow: '0 0 0 2px var(--ui-colors-focus)' },
} satisfies BoxProps
```

- [ ] **Step 2: Add the shared empty-state style**

```tsx
export const virtualSelectEmptyProps = {
  alignItems: 'center',
  color: 'muted',
  display: 'flex',
  fontSize: 'sm',
  minH: VIRTUAL_SELECT_ITEM_HEIGHT,
  px: '3',
  py: '2',
} satisfies BoxProps
```

- [ ] **Step 3: Add exact translations**

Add to `ja.json`:

```json
"virtual_select_clear": "検索をクリア",
"virtual_select_no_results": "該当する候補がありません"
```

Add to `en.json`:

```json
"virtual_select_clear": "Clear search",
"virtual_select_no_results": "No matching options"
```

- [ ] **Step 4: Run focused non-DOM assertions**

Run: `npx ts-node -e "require('./src/web/components/virtualSelectDropdowns.selfcheck')._selfCheckVirtualSelectDropdowns()"`

Expected: PASS for new shared styles; the full DOM self-check remains RED until Task 3.

- [ ] **Step 5: Commit shared presentation and copy**

```powershell
git add -- src/web/components/virtualSelectStyles.ts src/web/i18n/locales/ja.json src/web/i18n/locales/en.json
git commit -m "style: add virtual autocomplete states"
```

### Task 3: Implement Version and Sound clear/empty states

**Files:**
- Modify: `src/web/Main/VersionSelector.tsx`
- Modify: `src/web/Sub/components/AudioSelectDropdown.tsx`

**Interfaces:**
- Consumes: shared clear/empty props, locale keys, existing callbacks and virtual-list refs.
- Preserves: `VirtualVersionSelect` and `AudioSelectDropdown` public props.

- [ ] **Step 1: Make popup visibility depend on source candidates**

In Version pass the unfiltered selectable count to `isVirtualSelectPopupVisible`; in Sound pass `options.length`. Filtered length chooses between list and empty state.

```tsx
const selectableVersionCount = useMemo(
  () => rows.filter(row => row.type === 'version').length,
  [rows],
)
const popupVisible = isVirtualSelectPopupVisible(open, selectableVersionCount)
```

```tsx
const popupVisible = isVirtualSelectPopupVisible(open, options.length)
```

- [ ] **Step 2: Add Version clear behavior**

Add this callback, retaining the selection callback untouched:

```tsx
const clearQuery = useCallback(() => {
  setInputValue('')
  setQuery('')
  const nextIndex = rows.findIndex(row => row.type === 'version')
  if (nextIndex >= 0) activate(nextIndex)
  requestAnimationFrame(() => inputRef.current?.focus())
}, [activate, rows])
```

Render a `Box as="button" type="button"` with `XIcon`, localized `aria-label`, `data-virtual-select-clear="version"`, `onMouseDown={event => event.preventDefault()}`, and `onClick={clearQuery}` only when `open && inputValue.length > 0 && !disabled`; otherwise render the existing chevron.

- [ ] **Step 3: Add Sound clear behavior**

Import `useTranslation`, `XIcon`, and shared props. Add:

```tsx
const { t } = useTranslation()
const clearQuery = () => {
  setInputValue('')
  setActiveIndex(0)
  setOpen(true)
  requestAnimationFrame(() => inputRef.current?.focus())
}
```

Use the same conditional end-control and pointer/focus protection. Do not call `onSelect`.

- [ ] **Step 4: Render localized empty states**

Inside each existing popup shell, keep `VirtualList` when results exist. Otherwise render:

```tsx
<Box {...virtualSelectEmptyProps} data-virtual-select-empty role="status">
  {t('virtual_select_no_results')}
</Box>
```

Version checks filtered selectable count; Sound checks `filteredOptions.length`.

- [ ] **Step 5: Guard keyboard activation with empty results**

Keep `aria-activedescendant` undefined and Enter inert when no filtered option exists. Update only code required by the failing assertions.

- [ ] **Step 6: Run the complete self-check and verify GREEN**

Run: `npm run selfcheck`

Expected: PASS; both selectors clear transient queries without selection callbacks, display empty status text, and restore virtualized results.

- [ ] **Step 7: Commit component implementation**

```powershell
git add -- src/web/Main/VersionSelector.tsx src/web/Sub/components/AudioSelectDropdown.tsx
git commit -m "feat: add virtual autocomplete controls"
```

### Task 4: Regression and visual verification

**Files:**
- Verify only: all files changed in Tasks 1-3.

**Interfaces:**
- Verifies the complete approved design and repository quality gates.

- [ ] **Step 1: Run automated verification**

```powershell
npm run selfcheck
npx tsc --noEmit
npx eslint src/web/Main/VersionSelector.tsx src/web/Sub/components/AudioSelectDropdown.tsx src/web/components/virtualSelectStyles.ts src/web/components/virtualSelectDropdowns.selfcheck.tsx src/web/components/virtualSelectDropdowns.dom.selfcheck.tsx
npm run build
git diff --check HEAD~3
```

Expected: every command exits `0`. Existing webpack size warnings are acceptable; new TypeScript, ESLint, React, or accessibility warnings are not.

- [ ] **Step 2: Confirm protected details**

```powershell
rg -n 'width="14rem"|FixedSizeList|VIRTUAL_SELECT_ITEM_HEIGHT|VersionStatusIcon|focusRequest|data-virtual-select-clear|data-virtual-select-empty' src/web/Main/VersionSelector.tsx src/web/Sub/components/AudioSelectDropdown.tsx
git status --short
```

Expected: both components still import `FixedSizeList`; Version remains `14rem`; row height and Version status icons remain; Sound focus-request logic remains; both new states exist; only the user's pre-existing untracked `.claude/` may remain.

- [ ] **Step 3: Inspect the final diff**

Review `git show --stat HEAD~2..HEAD` and `git diff HEAD~3..HEAD --` to confirm there is no change to Version persistence/download logic or Sound selection/focus-request semantics.

- [ ] **Step 4: Perform visual QA when launchable**

Run the application and inspect both selectors in light and dark themes. Confirm clear/chevron swapping, empty-state spacing, popup width, row alignment, keyboard focus, and virtual scrolling. If local Tauri launch is unavailable, record that limitation and rely on DOM/build verification.

- [ ] **Step 5: Fix any discovered regression test-first**

For any reproducible issue, add the smallest failing assertion to the DOM self-check, run `npm run selfcheck` to observe RED, make the minimal fix, rerun Step 1, and commit with `fix: polish virtual autocomplete selectors`.

