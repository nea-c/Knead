# Virtual Select Caret and Status Icon Design

## Goal

Align the editable text and caret in the Main window VersionSelector and the Sub window SoundSelector slightly lower, while removing only the status icon displayed inside the VersionSelector trigger.

## Scope

- Keep the VersionSelector width at `14rem`.
- Keep the SoundSelector parent width at `240px`.
- Keep both selectors searchable and retain their intentional text caret.
- Keep the right-side chevron in both selectors.
- Keep download/check status icons in VersionSelector option rows.
- Remove the check/download status icon from the VersionSelector input trigger only.
- Do not change Version persistence, restoration, download behavior, filtering, grouping, virtualization, or keyboard behavior.
- Do not change Sound selection, filtering, focus-request, virtualization, or keyboard behavior.

## Design

The shared `virtualSelectTriggerProps` will add an explicit `paddingTop: '1px'`. Both editable virtual-select inputs consume this shared style, so their text and native caret move down consistently without changing the controls' width or minimum height.

The VersionSelector trigger's separately positioned `VersionStatusIcon` wrapper will be removed. Its input start padding will return to the normal shared value because the trigger no longer needs space for the icon. `VersionStatusIcon` itself remains in use by virtualized option rows, preserving their downloaded/not-downloaded indication.

## Testing

The existing virtual-select self-check will be updated before production code:

- require the shared trigger to expose the 1px top padding;
- require Version trigger markup not to contain the start status-icon marker;
- continue requiring the right-side chevron;
- require disabled Version markup to contain opacity only for the input and chevron;
- continue checking unchanged dimensions and shared visual contracts.

After implementation, run the virtual-select self-check, TypeScript, focused ESLint, the production build, and `git diff --check`. Review the final diff to confirm that widths and option-row icons remain unchanged.
