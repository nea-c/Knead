# Yamada UI v2 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Knead to the latest stable Yamada UI release and its compatible React stack without changing application behavior.

**Architecture:** Replace the top-level UI dependency graph as one atomic npm installation, then use the existing self-check, TypeScript/webpack build, and ESLint configuration as migration gates. Source files change only when a gate demonstrates a concrete Yamada UI 2 or React 19 incompatibility; each such incompatibility is reproduced before its minimal fix.

**Tech Stack:** npm, TypeScript 5, React 19, Yamada UI 2, Emotion 11, Motion 12, webpack 5, ESLint 9

## Global Constraints

- Use stable releases only; do not use npm `next` or `dev` tags.
- Set `@yamada-ui/react` to `^2.2.4` and `@yamada-ui/lucide` to `^1.10.5`.
- Set React and React DOM to `^19.2.7` because Yamada UI 2.2.4 requires React 19 or newer.
- Set `@types/react` to `^19.2.17` and `@types/react-dom` to `^19.2.3`.
- Satisfy Yamada UI peer dependencies directly with `motion` `^12.42.2`, `@emotion/react` `^11.14.0`, and `@emotion/styled` `^11.14.1`.
- Do not use `--force` or `--legacy-peer-deps`.
- Preserve the existing component structure, behavior, and visual intent.
- Do not upgrade unrelated direct dependencies or weaken compiler/lint settings.
- Preserve the user's unrelated untracked `.claude/` directory.

---

### Task 1: Upgrade the UI dependency graph

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: the existing npm package manifest and lockfile
- Produces: a reproducible dependency graph containing Yamada UI 2.2.4, React 19.2.7, and compatible peer dependencies

- [ ] **Step 1: Capture the pre-upgrade verification baseline**

Run these commands without editing source files:

```powershell
npm.cmd run selfcheck
npm.cmd run build
npx.cmd eslint "src/**" --no-error-on-unmatched-pattern
git status --short
```

Expected: `selfcheck`, `build`, and non-fixing ESLint exit successfully. Record any pre-existing failure verbatim before proceeding. `git status --short` must show no tracked changes; the unrelated `?? .claude/` entry and this plan file are allowed.

- [ ] **Step 2: Install the exact compatible stable dependency set**

Run:

```powershell
npm.cmd install @yamada-ui/react@^2.2.4 @yamada-ui/lucide@^1.10.5 react@^19.2.7 react-dom@^19.2.7 motion@^12.42.2 @emotion/react@^11.14.0 @emotion/styled@^11.14.1 --save
npm.cmd install @types/react@^19.2.17 @types/react-dom@^19.2.3 --save-dev
```

Expected: both commands exit 0 without `ERESOLVE`; only `package.json`, `package-lock.json`, and npm-managed `node_modules` content change.

- [ ] **Step 3: Verify the manifest contains the intended direct dependencies**

Run:

```powershell
node.exe -e "const p=require('./package.json'); const expected={dependencies:{'@yamada-ui/react':'^2.2.4','@yamada-ui/lucide':'^1.10.5',react:'^19.2.7','react-dom':'^19.2.7',motion:'^12.42.2','@emotion/react':'^11.14.0','@emotion/styled':'^11.14.1'},devDependencies:{'@types/react':'^19.2.17','@types/react-dom':'^19.2.3'}}; for(const [group,entries] of Object.entries(expected)) for(const [name,want] of Object.entries(entries)) { const got=p[group]?.[name]; if(got!==want) throw new Error(group+'.'+name+': expected '+want+', got '+got) }"
```

Expected: exit 0 with no output.

- [ ] **Step 4: Verify npm resolved a valid peer dependency graph**

Run:

```powershell
npm.cmd ls @yamada-ui/react @yamada-ui/lucide react react-dom motion @emotion/react @emotion/styled
```

Expected: exit 0; the tree contains `@yamada-ui/react@2.2.4`, `@yamada-ui/lucide@1.10.5`, `react@19.2.7`, and `react-dom@19.2.7`, with no `invalid`, `UNMET DEPENDENCY`, or peer dependency errors.

- [ ] **Step 5: Inspect and commit the dependency-only diff**

Run:

```powershell
git diff --check
git diff -- package.json package-lock.json
git add -- package.json package-lock.json
git commit -m "build: upgrade to Yamada UI 2"
```

Expected: the whitespace check exits 0 and the commit contains only the intended manifest and npm lockfile changes. Scripts, package metadata, and unrelated direct dependency ranges remain unchanged.

---

### Task 2: Prove source compatibility and make only demonstrated migration fixes

**Files:**
- Inspect: `src/web/**/*.ts`
- Inspect: `src/web/**/*.tsx`
- Modify only when a verification command fails: the exact source file named by that failure
- Test only when a source-level behavior fix is required: the nearest existing `*.selfcheck.ts`, `*.selfcheck.tsx`, or `*.dom.selfcheck.tsx` file covering that behavior

**Interfaces:**
- Consumes: the dependency graph produced by Task 1 and all current imports from `@yamada-ui/react` and `@yamada-ui/lucide`
- Produces: application source that type-checks and bundles against Yamada UI 2 and React 19 while retaining the current exported component interfaces

- [ ] **Step 1: Run the behavioral self-check against the upgraded graph**

Run:

```powershell
npm.cmd run selfcheck
```

Expected: exit 0. If it fails, preserve the failing output and invoke `superpowers:systematic-debugging`; do not change source until the failure is reduced to a specific compatibility cause. For a behavior change exercisable by an existing self-check file, add the minimal failing assertion there and rerun it to confirm RED before changing production source.

- [ ] **Step 2: Run the TypeScript/webpack migration gate**

Run:

```powershell
npm.cmd run build
```

Expected: exit 0 with `webpack compiled successfully`. If it fails, treat each compiler diagnostic independently: confirm it names an API removed or changed by Yamada UI 2 or React 19, replace that call site with the package's typed replacement, and rerun the same build after each minimal edit. Do not use `any`, `@ts-ignore`, or compiler-setting changes.

- [ ] **Step 3: Run ESLint without automatic mutation**

Run:

```powershell
npx.cmd eslint "src/**" --no-error-on-unmatched-pattern
```

Expected: exit 0 with no errors. Fix only newly introduced diagnostics in files changed by this migration.

- [ ] **Step 4: Re-run the full migration gate after any source edit**

Run:

```powershell
npm.cmd run selfcheck
npm.cmd run build
npx.cmd eslint "src/**" --no-error-on-unmatched-pattern
git diff --check
```

Expected: every command exits 0, webpack reports successful compilation, and `git diff --check` reports no whitespace errors.

- [ ] **Step 5: Commit source compatibility changes only if they exist**

Run:

```powershell
git status --short
git diff -- src
```

If no tracked files under `src/` changed, do not create an empty commit. If files did change, stage only those reviewed source and self-check files:

```powershell
git add -- src
git commit -m "fix: migrate UI usage to Yamada UI 2"
```

Expected: the commit contains only source and self-check changes required by demonstrated Yamada UI 2 or React 19 incompatibilities.

---

### Task 3: Final dependency and repository verification

**Files:**
- Verify: `package.json`
- Verify: `package-lock.json`
- Verify: any `src/` files changed in Task 2

**Interfaces:**
- Consumes: completed dependency and source migration commits
- Produces: evidence that the repository is clean apart from pre-existing unrelated files and that the upgraded application passes all available checks

- [ ] **Step 1: Invoke completion verification discipline**

Read and follow `superpowers:verification-before-completion` before making any success claim.

- [ ] **Step 2: Run all project verification from a fresh command invocation**

Run:

```powershell
npm.cmd run selfcheck
npm.cmd run build
npx.cmd eslint "src/**" --no-error-on-unmatched-pattern
npm.cmd ls @yamada-ui/react @yamada-ui/lucide react react-dom motion @emotion/react @emotion/styled
git diff --check
git status --short
```

Expected: all checks exit 0; npm reports the exact intended stable versions with no invalid peers; no tracked implementation changes remain. The plan file and pre-existing unrelated `?? .claude/` entry may remain untracked.

- [ ] **Step 3: Review the resulting commits and summarize the migration**

Run:

```powershell
git log -3 --oneline
git show --stat --oneline HEAD
git status --short
```

Expected: history includes the dependency upgrade commit and, only if needed, a focused source compatibility commit. The handoff reports installed versions, source migrations performed, verification commands and results, and any pre-existing baseline failure separately.

