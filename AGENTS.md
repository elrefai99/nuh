# Repository Guidelines

## Project Structure

This is a small TypeScript project. Application entry code is in `src/index.ts`; physics calculations are under `src/Physics/`, and shared constants are in `src/shared/`. There is no dedicated test or assets directory yet. TypeScript configuration is in `tsconfig.json`, with output configured for `dist/`.

## Build and Development

Use pnpm, which is tracked by `pnpm-lock.yaml`:

- `pnpm install` installs the locked dependencies.
- `pnpm exec ts-node src/index.ts` runs the entry point directly.
- `pnpm exec tsc --noEmit` checks TypeScript without generating output.

No build script is currently defined. The `test` script is still the npm placeholder and exits with an error; do not treat it as a working test suite.

## Coding Style

Write TypeScript in `src/`, use relative imports, and keep modules focused by domain. Use PascalCase for class names and module directory names (for example, `Schwarzschild`), camelCase for variables and methods, and UPPER_SNAKE_CASE for shared constant objects such as `PHYSICS`. Follow the existing semicolon and indentation style in the file you are editing; formatting and lint tools are not currently configured. Validate changes with `pnpm exec tsc --noEmit`.

## Testing

No test framework or coverage target is configured. When adding tests, introduce a test runner and a `test` script, and place tests alongside the relevant modules or in a dedicated test directory. Include cases for invalid inputs and boundary conditions in numerical code. Until then, use the TypeScript check and manually exercise the affected entry point.

## Commits and Pull Requests

The short Git history uses Conventional Commit style (for example, `feat: add initial project files`). Keep subjects concise and use a matching type such as `feat`, `fix`, or `docs`. Pull requests should describe the change and its rationale, list validation performed, and link a related issue when one exists. Include screenshots only for changes with a visual interface.

## Configuration

Do not commit secrets or local environment files. Dependencies are managed through `package.json` and `pnpm-lock.yaml`; update both when changing dependencies.
