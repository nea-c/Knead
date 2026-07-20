# Virtual Autocomplete Follow-up Design

- Date: 2026-07-21
- Status: Approved design
- Scope: Main `VirtualVersionSelect` and Sub `AudioSelectDropdown`

## Goal

Correct the Sub Sound selector so opening a selected sound shows every candidate until the user actually types a query. Add Yamada UI Select-like opening and closing motion to both virtualized selectors, and lower both text carets by one additional pixel.

## Root Cause

`AudioSelectDropdown` currently uses `inputValue` for two independent responsibilities:

1. displaying the committed Sound ID in the open input;
2. filtering the option list.

`openDropdown` copies the committed `value` into `inputValue`, so `filteredOptions` immediately filters by that full Sound ID. The Main Version selector does not have this problem because it keeps separate `inputValue` and `query` states.

## State Design

Add a dedicated `query` state to `AudioSelectDropdown`.

- Opening from the trigger sets `inputValue` to the committed Sound ID and `query` to an empty string.
- A focus request follows the same rule.
- Typing updates both `inputValue` and `query`.
- Filtering uses only `query`.
- Clearing resets both values to empty strings and does not change the committed selection.
- Selecting retains the existing callback and close behavior.

This matches the existing Version state pattern without merging the two components or changing virtualization.

## Animation Design

Both popup shells use a shared Yamada UI Select-like scale/fade transition:

- Enter: opacity `0` and scale `0.95` to opacity `1` and scale `1`.
- Exit: reverse the same values.
- Duration: `0.2s`.
- Transform origin: top center.
- Reduced motion: disable duration and transforms when `prefers-reduced-motion: reduce` is active.

Because the current popups are conditionally unmounted as soon as `open` becomes false, introduce a small shared presence hook or helper that keeps the popup mounted for the exit duration. The popup must become non-interactive and hidden from accessibility while exiting. Reopening during the exit interval cancels the pending unmount.

Virtualized list dimensions and `react-window` instances remain unchanged while mounted.

## Caret Alignment

Change shared `virtualSelectTriggerProps.paddingTop` from `1px` to `2px`. Both selectors consume this shared style, so input text and native carets move down consistently. Heights, widths, horizontal padding, and option-row alignment remain unchanged.

## Accessibility and Interaction

- Preserve all combobox/listbox roles and keyboard behavior.
- `aria-expanded` reflects logical open state, not exit-presence state.
- Exiting popups use `aria-hidden` and disabled pointer events.
- Clear controls retain accessible labels and do not update selection.
- Outside click and Escape initiate the same animated close.
- Reduced-motion users do not wait for an exit animation.

## Testing

Add failing tests before production changes:

- Opening a Sound selector with a committed value renders every option.
- Typing still filters Sound options.
- Focus-request opening also renders every option.
- Shared caret padding equals `2px`.
- Popup styles define the `0.95` scale, `0.2s` duration, and top transform origin.
- Closing keeps the popup mounted as an exiting, non-interactive element until the duration elapses, then removes it.
- Reduced-motion behavior bypasses the delayed exit when testable without browser media emulation.

Run the full self-check, TypeScript, focused ESLint, production build, and `git diff --check`. Preserve the existing untracked `.claude/` directory.

