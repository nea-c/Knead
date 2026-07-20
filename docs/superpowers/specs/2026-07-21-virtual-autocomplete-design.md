# Virtual Autocomplete Design

- Date: 2026-07-21
- Status: Approved design
- Scope: Main `VersionSelector` and Sub `AudioSelectDropdown` (Sound selector)

## Goal

Restyle the Main window Version selector and Sub window Sound selector to resemble Yamada UI Autocomplete controls while preserving their existing virtual scrolling, filtering, selection, and keyboard behavior. Add clear controls and a localized no-results state without changing the committed selection when a search query is cleared.

## Constraints

- Keep the existing `react-window` virtualization in both selectors.
- Keep the Version selector width at `14rem` and the Sound selector's surrounding layout unchanged.
- Do not replace either selector with Yamada UI's `Autocomplete` component.
- Do not change Version grouping, ordering, persistence, download behavior, or option-row status icons.
- Do not change Sound selection, focus-request behavior, or option ordering.
- Preserve outside-click closing and ArrowUp, ArrowDown, Enter, and Escape behavior.
- Preserve the existing combobox/listbox accessibility relationship.
- Support the existing light and dark themes.

## Architecture

Keep the two selectors as separate stateful components because their data and side effects differ. Extend the shared virtual-select presentation contract in `src/web/components/virtualSelectStyles.ts` with Autocomplete-oriented trigger, end-control, and empty-state styles. The components continue to own filtering and virtual-list data while consuming the shared visual definitions.

Small shared presentation helpers may be introduced when they remove duplicated styling, but Version-specific grouping and status rendering and Sound-specific focus behavior remain in their current components.

## Trigger Design

Both controls retain an editable input with the current dimensions, typography, border, focus ring, disabled appearance, and theme integration. The visual treatment will be adjusted toward Yamada UI Autocomplete rather than introducing a new brand palette or typography system.

The end control follows one rule:

- When the open input contains search text, show an accessible clear button.
- When the open input is empty, or when the selector is closed, show the existing dropdown chevron.
- Disabled controls do not expose an interactive clear button.

Activating the clear button clears only the transient input/query, resets keyboard activation to the first selectable result, keeps the popup open, and restores the full candidate set. It does not call the selection callback and therefore does not change the committed Version or Sound value.

The clear button must prevent its pointer interaction from causing the input's blur/outside-click behavior to close the popup before the query is cleared. Keyboard users can focus and activate it, and the control receives a localized accessible label.

## Popup and Empty State

When a selector is open, it displays the same shared Autocomplete-style popup shell whether results exist or not.

- With results, the existing virtualized list is rendered unchanged in principle.
- With no results, no zero-row virtual list is mounted. A compact shared empty-state row is rendered instead.
- The empty-state message is localized in Japanese and English and communicates that no matching candidates were found.

Version grouping headings, option row heights, selected/active backgrounds, status icons, truncation, and tooltips remain compatible with the fixed-size virtual-list calculations. The Sound option rows retain their fixed size for the same reason.

## State and Interaction Flow

Opening a selector continues to initialize its transient input from the committed value and scroll the virtual list to the selected or first selectable option.

Typing updates only the transient input and filter query. If matches exist, keyboard activation is kept on or moved to a selectable row. If no matches exist, the empty state is shown and Enter performs no selection.

Clearing resets the transient input and query to empty strings. Version recalculates grouped rows and activates the first version row, skipping headings. Sound activates its first option. The committed selection remains unchanged until the user explicitly chooses an option.

Selecting an option retains the current behavior: update the committed value through the existing callback, update the transient input, and close the popup.

## Accessibility

- Keep `role="combobox"`, `aria-autocomplete="list"`, `aria-haspopup="listbox"`, `aria-expanded`, and `aria-controls` on each input.
- Keep `role="listbox"` and `role="option"` for result lists and options.
- Only provide `aria-activedescendant` when a matching selectable option is active.
- Give the clear button a localized accessible name and make its icon decorative.
- Represent the no-results content as status text within the popup rather than as a selectable option.
- Retain visible keyboard focus styles for both the input and clear button.

## Localization

Add Japanese and English strings for:

- Clear search input.
- No matching candidates.

The same strings are shared by the Version and Sound selectors unless existing copy conventions require selector-specific wording.

## Testing

Extend the existing virtual-select self-checks before production changes. Tests must verify:

- A non-empty open query renders a clear button instead of the chevron.
- Activating clear removes the query, restores candidates, keeps the popup open, and does not invoke the selection callback.
- An empty query shows the chevron.
- A zero-match query renders the localized empty state and does not mount a zero-item virtual list.
- Version grouping/status rows and Sound options still render through `react-window` when matches exist.
- Existing keyboard, ARIA, disabled, dimensions, and shared-style assertions remain valid.

After focused self-checks pass, run TypeScript checking, focused ESLint, the production build, and `git diff --check`. Manually inspect both windows in light and dark themes if the local application can be launched.

## Out of Scope

- Replacing custom selectors with Yamada UI Autocomplete.
- Refactoring both selectors into one stateful generic component.
- Multiple selection, free-form value creation, asynchronous server-side search, or highlighted query substrings.
- Changes to the main Sound library list in `src/web/Main/SoundSelector.tsx`.
