# Virtual Select Visual Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main の Version と Sub の Sound の独自仮想プルダウンを、標準 Yamada UI `Select` と同じ外観へ統一する。

**Architecture:** `src/web/components/virtualSelectStyles.ts` に Yamada UI 1.7.2 の `Input` / `Select` テーマに対応する共通スタイルを置く。Version と Sound は状態管理、検索、仮想化を維持したまま同じトリガー・メニュー・候補行スタイルを利用し、Sound には標準 Select と同等の combobox セマンティクスを補う。

**Tech Stack:** React 18、React DOM Server、TypeScript 5.7、Yamada UI 1.7.2、react-window 1.8、ts-node self-check、ESLint、Webpack

## Global Constraints

- 標準 `Select` へ置換しない。
- Version の分類見出し、downloaded 状態アイコン、仮想化、キーボード操作を維持する。
- Sound の空白区切り AND 検索、focus request、仮想化、キーボード操作を維持する。
- 固定 HEX 色を追加せず、Yamada UI のライト／ダーク対応トークンを使う。
- 候補取得、並び順、ダウンロード、選択値更新のロジックを変更しない。
- 既存の未コミット変更を巻き込まず、対象ファイルだけをステージする。

---

## File Structure

- Create: `src/web/components/virtualSelectStyles.ts` — 仮想プルダウンの共通スタイル値と候補行状態の純粋関数。
- Create: `src/web/components/virtualSelectDropdowns.selfcheck.tsx` — Sound トリガーの combobox 契約と共通スタイル契約を検査。
- Modify: `src/web/Main/VersionSelector.tsx` — Version のトリガー、メニュー、行へ共通スタイルを適用。
- Modify: `src/web/Sub/components/AudioSelectDropdown.tsx` — Sound のトリガー、シェブロン、メニュー、行、ARIA へ共通スタイルを適用。
- Modify: `package.json` — 新しい self-check を既存 `selfcheck` スクリプトへ追加。

### Task 1: 仮想プルダウンの共有契約と両コンポーネントを実装

**Files:**
- Create: `src/web/components/virtualSelectDropdowns.selfcheck.tsx`
- Create: `src/web/components/virtualSelectStyles.ts`
- Modify: `src/web/Main/VersionSelector.tsx:1-230`
- Modify: `src/web/Sub/components/AudioSelectDropdown.tsx:1-170`
- Modify: `package.json:17`

**Interfaces:**
- Produces: `VIRTUAL_SELECT_ITEM_HEIGHT: 36`
- Produces: `virtualSelectTriggerProps`, `virtualSelectMenuProps`, `virtualSelectItemProps`, `virtualSelectActiveItemProps`, `virtualSelectSelectedItemProps`, `virtualSelectHeadingProps`
- Produces: `getVirtualSelectItemState(selected: boolean, active: boolean): 'selected' | 'active' | 'idle'`
- Preserves: `VersionSelector` and `AudioSelectDropdown` public props and selection callbacks.

- [ ] **Step 1: Write the failing Sound combobox self-check**

Create `src/web/components/virtualSelectDropdowns.selfcheck.tsx` against the current component:

```tsx
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { UIProvider } from '@yamada-ui/react'
import { AudioSelectDropdown } from '../Sub/components/AudioSelectDropdown'

export function _selfCheckVirtualSelectDropdowns(): void {
  const html = renderToStaticMarkup(
    <UIProvider>
      <AudioSelectDropdown
        options={['minecraft:block.note_block.harp']}
        value="minecraft:block.note_block.harp"
        onSelect={() => undefined}
      />
    </UIProvider>,
  )

  assert.match(html, /role="combobox"/)
  assert.match(html, /aria-haspopup="listbox"/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /aria-controls="[^"]+"/)
}
```

Append it to the existing `package.json` self-check command:

```json
"selfcheck": "npx ts-node -e \"require('./src/web/Sub/utils/tickPixel')._selfCheckTickPixel(); require('./src/web/Sub/utils/timelineIO')._selfCheckTimelineIO(); require('./src/web/Sub/utils/curvePresets')._selfCheckCurvePresets(); require('./src/web/Sub/utils/curveScaling')._selfCheckCurveScaling(); require('./src/web/Sub/utils/curveHandles')._selfCheckCurveHandles(); require('./src/web/Sub/utils/projectFiles')._selfCheckProjectFiles(); require('./src/web/components/virtualSelectDropdowns.selfcheck')._selfCheckVirtualSelectDropdowns()\""
```

- [ ] **Step 2: Run the self-check and verify RED**

Run: `npm run selfcheck`

Expected: assertion failure for missing `role="combobox"`. The command must reach the assertion; module-resolution or TypeScript syntax failures do not count as the expected RED.

- [ ] **Step 3: Add the common Yamada Select style contract**

Create `src/web/components/virtualSelectStyles.ts`:

```ts
import type { BoxProps } from '@yamada-ui/react'

export const VIRTUAL_SELECT_ITEM_HEIGHT = 36

export const virtualSelectTriggerProps = {
  bg: 'inherit',
  border: '1px solid',
  borderColor: 'inherit',
  fontSize: 'md',
  fontWeight: 'normal',
  minH: '10',
  px: '3',
  rounded: 'md',
  transitionDuration: 'normal',
  transitionProperty: 'border-color, box-shadow, background-color, opacity',
  _hover: { borderColor: ['blackAlpha.500', 'whiteAlpha.400'] },
  _focusVisible: {
    borderColor: 'focus',
    boxShadow: '0 0 0 1px var(--ui-colors-focus)',
  },
  _disabled: { cursor: 'not-allowed', opacity: 0.4 },
} satisfies BoxProps

export const virtualSelectMenuProps = {
  bg: ['white', 'black'],
  border: '1px solid',
  borderColor: ['blackAlpha.200', 'whiteAlpha.100'],
  boxShadow: ['lg', 'dark-lg'],
  overflow: 'hidden',
  rounded: 'md',
} satisfies BoxProps

export const virtualSelectItemProps = {
  cursor: 'pointer',
  px: '3',
  transitionDuration: 'ultra-fast',
  transitionProperty: 'background',
  transitionTimingFunction: 'ease-in',
  userSelect: 'none',
} satisfies BoxProps

export const virtualSelectActiveItemProps = {
  bg: ['blackAlpha.100', 'whiteAlpha.100'],
} satisfies BoxProps

export const virtualSelectSelectedItemProps = {
  bg: ['blackAlpha.200', 'whiteAlpha.200'],
} satisfies BoxProps

export const virtualSelectHeadingProps = {
  color: 'muted',
  fontSize: 'sm',
  fontWeight: 'semibold',
  px: '3',
} satisfies BoxProps

export function getVirtualSelectItemState(
  selected: boolean,
  active: boolean,
): 'selected' | 'active' | 'idle' {
  if (selected) return 'selected'
  if (active) return 'active'
  return 'idle'
}
```

Extend the still-failing self-check before using these exports in either UI:

```tsx
import {
  VIRTUAL_SELECT_ITEM_HEIGHT,
  getVirtualSelectItemState,
  virtualSelectActiveItemProps,
  virtualSelectMenuProps,
  virtualSelectSelectedItemProps,
  virtualSelectTriggerProps,
} from './virtualSelectStyles'

assert.equal(VIRTUAL_SELECT_ITEM_HEIGHT, 36)
assert.equal(virtualSelectTriggerProps.minH, '10')
assert.equal(virtualSelectTriggerProps.rounded, 'md')
assert.equal(virtualSelectMenuProps.rounded, 'md')
assert.deepEqual(virtualSelectMenuProps.bg, ['white', 'black'])
assert.deepEqual(virtualSelectActiveItemProps.bg, ['blackAlpha.100', 'whiteAlpha.100'])
assert.deepEqual(virtualSelectSelectedItemProps.bg, ['blackAlpha.200', 'whiteAlpha.200'])
assert.equal(getVirtualSelectItemState(false, false), 'idle')
assert.equal(getVirtualSelectItemState(false, true), 'active')
assert.equal(getVirtualSelectItemState(true, false), 'selected')
assert.equal(getVirtualSelectItemState(true, true), 'selected')
```

Run `npm run selfcheck` again. Expected: it still fails only at the missing Sound combobox assertion, while the new style assertions pass.

- [ ] **Step 4: Apply the common contract to VersionSelector**

Replace `useColorModeValue` and the local `VERSION_ROW_HEIGHT` with imports from `../components/virtualSelectStyles`. Remove `headingColor`, `hoverBackground`, and `selectedBackground` from `VersionRowData` and its memoized value.

For headings:

```tsx
<Box {...virtualSelectHeadingProps} paddingY={2} role="presentation" style={style}>
  {row.label}
</Box>
```

For version rows:

```tsx
const state = getVirtualSelectItemState(selected, active)
const background = state === 'selected'
  ? virtualSelectSelectedItemProps.bg
  : state === 'active'
    ? virtualSelectActiveItemProps.bg
    : 'transparent'

<HStack
  {...virtualSelectItemProps}
  aria-selected={selected}
  bg={background}
  gap={2}
  onClick={() => data.onSelect(row.version.raw)}
  onMouseEnter={() => data.onActivate(index)}
  role="option"
  style={style}
  title={row.version.raw}
>
```

For the trigger and menu:

```tsx
<Button
  {...virtualSelectTriggerProps}
  aria-expanded={open}
  aria-haspopup="listbox"
  disabled={disabled}
  endIcon={<ChevronDownIcon aria-hidden transform={open ? 'rotate(180deg)' : undefined} transition="transform 0.15s" />}
  justifyContent="space-between"
  variant="unstyled"
  width="full"
>
```

```tsx
<Box
  {...virtualSelectMenuProps}
  left={0}
  position="absolute"
  role="listbox"
  top="calc(100% + 4px)"
  width="full"
  zIndex={50}
>
```

Use `VIRTUAL_SELECT_ITEM_HEIGHT` in list height and `itemSize`. Do not change version selection, persistence, download, or sound loading effects below `VirtualVersionSelect`.

- [ ] **Step 5: Apply the common contract and combobox semantics to Sound**

Import `ChevronDownIcon`, `useId`, and the shared styles. Set `const listboxId = useId()`. Move the existing `ref` from the menu to the outer `<Box>` so outside-click detection contains both trigger and popup.

Replace the hard-coded `<div>` row with:

```tsx
const state = getVirtualSelectItemState(selected, active)
const background = state === 'selected'
  ? virtualSelectSelectedItemProps.bg
  : state === 'active'
    ? virtualSelectActiveItemProps.bg
    : 'transparent'

return (
  <Box
    {...virtualSelectItemProps}
    aria-selected={selected}
    bg={background}
    id={`${listboxId}-option-${index}`}
    onClick={() => selectOption(opt)}
    onMouseEnter={() => setActiveIndex(index)}
    overflow="hidden"
    role="option"
    style={style}
    textOverflow="ellipsis"
    title={opt}
    whiteSpace="nowrap"
  >
    {opt}
  </Box>
)
```

Apply the shared trigger and ARIA contract to `Input` while retaining every existing value/click/change/key handler:

```tsx
<Input
  {...virtualSelectTriggerProps}
  aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
  aria-autocomplete="list"
  aria-controls={listboxId}
  aria-expanded={open}
  aria-haspopup="listbox"
  cursor={isDisabled ? 'not-allowed' : 'pointer'}
  pe="8"
  role="combobox"
/>
```

Add the Select chevron next to the Input:

```tsx
<Box
  aria-hidden
  color={['blackAlpha.600', 'whiteAlpha.700']}
  pointerEvents="none"
  position="absolute"
  right="2"
  top="50%"
  transform="translateY(-50%)"
>
  <ChevronDownIcon transform={open ? 'rotate(180deg)' : undefined} transition="transform 0.15s" />
</Box>
```

Render the menu only for `open && filteredOptions.length > 0`; apply `virtualSelectMenuProps`, `id={listboxId}`, `role="listbox"`, and `top="calc(100% + 4px)"`. Replace `ITEM_H` with `VIRTUAL_SELECT_ITEM_HEIGHT` in list height and `itemSize`.

- [ ] **Step 6: Run the self-check and verify GREEN**

Run: `npm run selfcheck`

Expected: exit code 0 with all SSR, shared-style, and existing assertions passing.

- [ ] **Step 7: Run focused static verification**

Run: `npx tsc --noEmit`

Expected: exit code 0.

Run: `npx eslint src/web/Main/VersionSelector.tsx src/web/Sub/components/AudioSelectDropdown.tsx src/web/components/virtualSelectStyles.ts src/web/components/virtualSelectDropdowns.selfcheck.tsx`

Expected: exit code 0. The repository's existing React-version detection warning is acceptable; file-level errors are not.

- [ ] **Step 8: Commit the implementation without staging unrelated files**

Review `git diff --cached --name-only` before commit. Stage only:

```bash
git add package.json src/web/components/virtualSelectStyles.ts src/web/components/virtualSelectDropdowns.selfcheck.tsx src/web/Main/VersionSelector.tsx src/web/Sub/components/AudioSelectDropdown.tsx
git commit -m "style: unify virtual select dropdowns"
```

### Task 2: Full verification and visual review

**Files:**
- Review: all Task 1 files

**Interfaces:**
- Verifies the complete user-visible result without changing public component APIs.

- [ ] **Step 1: Run all automated checks**

Run: `npm run selfcheck`

Expected: exit code 0.

Run: `npx tsc --noEmit`

Expected: exit code 0.

Run: `npx eslint src/web/Main/VersionSelector.tsx src/web/Sub/components/AudioSelectDropdown.tsx src/web/components/virtualSelectStyles.ts src/web/components/virtualSelectDropdowns.selfcheck.tsx`

Expected: no errors; the known React-version warning is acceptable.

Run: `npm run build`

Expected: build completes. The repository's existing webpack asset-size/performance warnings are acceptable; new errors are not.

Run: `git diff --check HEAD^ -- package.json src/web/components/virtualSelectStyles.ts src/web/components/virtualSelectDropdowns.selfcheck.tsx src/web/Main/VersionSelector.tsx src/web/Sub/components/AudioSelectDropdown.tsx`

Expected: no whitespace errors.

- [ ] **Step 2: Confirm scope and preserved behavior in the final diff**

Run: `git status --short`

Expected: existing unrelated modifications such as `src-tauri/Cargo.toml`, `src/web/Sub/App.tsx`, and `src/web/Sub/components/CurveEditor.tsx` remain untouched. Confirm the previously implemented selected-version restoration, persistence, and download guard remain in `VersionSelector.tsx`.

- [ ] **Step 3: Perform visual and interaction checks**

Start the existing development environment and verify:

1. Main Version、Sub Sound、Sub Variant have matching height, border, radius, background, and focus treatment.
2. Both custom menus match the standard Select list in light and dark modes.
3. Version headings and download icons remain correct.
4. Sound typing still filters by whitespace-separated AND terms.
5. Mouse, outside click, Arrow keys, Enter, Escape, and disabled behavior work.
6. Empty Sound results do not leave a zero-height bordered popup.

- [ ] **Step 4: Correct any visual regression with a new RED-GREEN cycle**

If review finds a testable regression, first add the smallest failing assertion to `virtualSelectDropdowns.selfcheck.tsx`, run `npm run selfcheck` to observe RED, make the minimal correction, then rerun all commands in Step 1. Stage only affected task files and commit with `fix: polish virtual select consistency`.
