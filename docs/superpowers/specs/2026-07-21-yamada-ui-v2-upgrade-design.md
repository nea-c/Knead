# Yamada UI v2 Upgrade Design

## Goal

Upgrade the application from Yamada UI 1 to the latest stable Yamada UI release while preserving existing application behavior.

The target versions confirmed from the npm registry on 2026-07-21 are:

- `@yamada-ui/react`: `2.2.4`
- `@yamada-ui/lucide`: `1.10.5`

## Scope

- Upgrade `@yamada-ui/react` and `@yamada-ui/lucide` to the target versions.
- Upgrade React, React DOM, and their TypeScript type packages to versions compatible with Yamada UI 2. Yamada UI 2.2.4 requires React and React DOM 19 or newer.
- Add or update direct peer dependencies required by Yamada UI 2 when npm does not provide a valid installation without them.
- Regenerate `package-lock.json` through npm.
- Make the smallest source changes needed to accommodate Yamada UI 2 and React 19 API or type changes.

## Non-goals

- No visual redesign or new functionality.
- No unrelated dependency upgrades.
- No unrelated refactoring.
- No migration to prerelease `next` or `dev` package tags.

## Compatibility Approach

Use the npm `latest` distribution tag for both Yamada UI packages. Keep the current component structure and styling intent. Where APIs have changed, adapt each call site to the documented replacement while preserving its observable behavior and appearance as closely as practical.

If an existing feature cannot be represented exactly with the new API, prefer the smallest local compatibility adjustment and document any visible difference in the implementation handoff.

## Dependency and Lockfile Flow

1. Record the current verification baseline.
2. Install the selected stable package versions together so npm resolves a coherent dependency graph.
3. Inspect the resulting dependency tree and peer dependency diagnostics.
4. Update application code only where compilation, tests, or runtime-oriented checks identify incompatibilities.
5. Keep `package.json` and `package-lock.json` synchronized.

## Error Handling

- Treat unresolved peer dependencies as a failed upgrade rather than bypassing them with `--force` or `--legacy-peer-deps`.
- Treat TypeScript errors in affected Yamada UI or React call sites as migration work, not as errors to suppress.
- Do not weaken lint or compiler settings to make the upgrade pass.

## Verification

Run the existing checks that cover the web application:

- `npm run selfcheck`
- `npm run build`
- `npm run lint`

Also inspect the installed versions with `npm ls` and ensure there are no invalid peer dependencies. If a command fails before the update for an unrelated existing reason, record that baseline and distinguish it from regressions introduced by the upgrade.

Because this task primarily changes dependency configuration and its generated lockfile, it uses the existing behavioral checks rather than adding a test that asserts package metadata. Any source-level behavior fix discovered during migration will follow test-first development where the current test infrastructure can exercise it.
