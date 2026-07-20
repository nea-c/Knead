# Virtual Select Caret and Status Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the editable VersionSelector and SoundSelector text caret down by 1px and remove only the VersionSelector trigger's left status icon.

**Architecture:** Keep the alignment correction in the shared virtual-select trigger props so both editable inputs receive the same adjustment without component-specific duplication. Remove the Version trigger's absolute status-icon wrapper and its conditional start padding, while retaining the existing status icon component in virtualized option rows.

**Tech Stack:** React 18, TypeScript, Yamada UI, react-window, Node `assert` self-checks, ESLint, webpack

## Global Constraints

- Keep the VersionSelector width at `14rem`.
- Keep the SoundSelector parent width at `240px`.
- Keep both selectors searchable and retain their intentional text caret.
- Keep the right-side chevron in both selectors.
- Keep download/check status icons in VersionSelector option rows.
- Remove the check/download status icon from the VersionSelector input trigger only.
- Do not change Version persistence, restoration, download behavior, filtering, grouping, virtualization, or keyboard behavior.
- Do not change Sound selection, filtering, focus-request, virtualization, or keyboard behavior.

---

### Task 1: Align shared editable triggers and remove the Version trigger icon

**Files:**
- Modify: `src/web/components/virtualSelectDropdowns.selfcheck.tsx`
- Modify: `src/web/components/virtualSelectStyles.ts`
- Modify: `src/web/Main/VersionSelector.tsx`

**Interfaces:**
- Consumes: `virtualSelectTriggerProps`, `VirtualVersionSelect`, and the existing `VersionStatusIcon` option-row renderer.
- Produces: shared `virtualSelectTriggerProps.paddingTop === '1px'`; Version trigger markup without `data-virtual-select-status-icon="start"`; unchanged option-row status icons and selector dimensions.

- [ ] **Step 1: Write the failing UI contract assertions**

In `src/web/components/virtualSelectDropdowns.selfcheck.tsx`, replace the Version trigger status assertion and disabled opacity count, and add the shared top-padding assertion:

```tsx
  assert.match(versionHtml, /<input[^>]*role="combobox"/)
  assert.doesNotMatch(versionHtml, /data-virtual-select-status-icon="start"/)
  assert.match(versionHtml, /data-virtual-select-chevron="end"/)

  const disabledVersionHtml = renderToStaticMarkup(
    <UIProvider>
      <VirtualVersionSelect
        disabled
        onChange={() => undefined}
        placeholder="Select version"
        rows={versionRows}
        value="1.21.1"
      />
    </UIProvider>,
  )

  assert.doesNotMatch(disabledVersionHtml, /data-virtual-select-status-icon="start"/)
  assert.equal(disabledVersionHtml.match(/opacity:0\.4/g)?.length, 2)

  assert.equal((virtualSelectTriggerProps as { paddingTop?: string }).paddingTop, '1px')
```

Keep the existing right-chevron, item-height, spacing, popup, color, and state assertions unchanged.

- [ ] **Step 2: Run the self-check and verify RED**

Run:

```powershell
npm run selfcheck
```

Expected: FAIL because the rendered Version trigger still contains `data-virtual-select-status-icon="start"`, disabled markup still contains three `opacity:0.4` declarations, and `virtualSelectTriggerProps.paddingTop` is `undefined`.

- [ ] **Step 3: Add the shared 1px top padding**

In `src/web/components/virtualSelectStyles.ts`, add `paddingTop: '1px'` to `virtualSelectTriggerProps` without changing `minH`, `px`, font size, borders, or width-related behavior:

```ts
export const virtualSelectTriggerProps = {
  bg: 'inherit',
  border: '1px solid',
  borderColor: 'inherit',
  fontSize: 'md',
  fontWeight: 'normal',
  minH: '10',
  paddingTop: '1px',
  px: '3',
  rounded: 'md',
  transitionDuration: 'normal',
  transitionProperty: 'border-color, box-shadow, background-color, opacity',
  _hover: { borderColor: ['blackAlpha.500', 'whiteAlpha.400'] },
  _focusVisible: {
    borderColor: 'focus',
    boxShadow: '0 0 0 1px var(--ui-colors-focus)',
  },
  _disabled: { cursor: 'not-allowed', opacity: VIRTUAL_SELECT_DISABLED_OPACITY },
} satisfies BoxProps
```

- [ ] **Step 4: Remove only the Version trigger status icon**

In `src/web/Main/VersionSelector.tsx`, delete this complete `selectedVersion` memo because it is no longer needed by the trigger:

```tsx
  const selectedVersion = useMemo(() => {
    const row = rows.find((row): row is Extract<VersionRow, { type: 'version' }> => {
      return row.type === 'version' && row.version.raw === value
    })
    return row?.version
  }, [rows, value])
```

Remove the conditional start padding from the Version input so it uses the shared `px: '3'` value:

```tsx
        pe="8"
```

Delete this absolute trigger-only wrapper:

```tsx
      {selectedVersion && (
        <Box
          aria-hidden
          data-virtual-select-status-icon="start"
          left="3"
          opacity={disabled ? VIRTUAL_SELECT_DISABLED_OPACITY : 1}
          pointerEvents="none"
          position="absolute"
          top="50%"
          transform="translateY(-50%)"
        >
          <VersionStatusIcon downloaded={selectedVersion.downloaded} />
        </Box>
      )}
```

Do not modify `VirtualVersionRow`; it must continue rendering:

```tsx
      <VersionStatusIcon downloaded={row.version.downloaded} />
```

- [ ] **Step 5: Run the self-check and verify GREEN**

Run:

```powershell
npm run selfcheck
```

Expected: PASS, including the new 1px shared padding and absence of the Version trigger start-icon marker.

- [ ] **Step 6: Run focused and full verification**

Run:

```powershell
npx tsc --noEmit
npx eslint src/web/Main/VersionSelector.tsx src/web/Sub/components/AudioSelectDropdown.tsx src/web/components/virtualSelectStyles.ts src/web/components/virtualSelectDropdowns.selfcheck.tsx
npm run build
git diff --check
rg -n 'width="14rem"|w="240px"|VersionStatusIcon' src/web/Main/VersionSelector.tsx src/web/Sub/components/TimelinePropertyPanel.tsx
git status --short
```

Expected: all commands exit 0; only the existing React-version ESLint warning and webpack bundle-size warnings may appear. The width search must show Version `14rem`, Sound parent `240px`, and `VersionStatusIcon` still used by the virtualized option row.

- [ ] **Step 7: Review and commit the implementation**

Review the diff to ensure only the three intended source files changed, then run:

```powershell
git add src/web/Main/VersionSelector.tsx src/web/components/virtualSelectStyles.ts src/web/components/virtualSelectDropdowns.selfcheck.tsx
git commit -m "fix: align virtual select carets"
```

Expected: one implementation commit containing the failing-contract update and minimal production fix.
