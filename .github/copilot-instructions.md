# Copilot Instructions for GitHub Action Development

This repository contains a custom GitHub Action written in TypeScript. Follow these patterns and
guidelines when contributing.

## Project Structure

```
├── .github/
│   └── workflows/          # CI/CD workflows
├── src/
│   ├── index.ts           # Action entrypoint (imports and runs main)
│   ├── main.ts            # Main action logic
│   └── *.ts               # Additional source modules
├── __tests__/             # Vitest unit tests
├── __fixtures__/          # Test fixtures and mocks
├── dist/                  # Bundled output (committed to repo)
├── action.yml             # Action metadata
├── package.json
├── tsconfig.json
└── vitest.config.ts       # Vitest configuration
```

## Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js (v20+)
- **Bundler**: @vercel/ncc (bundles to single `dist/index.js`)
- **Testing**: Vitest
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier

## Development Patterns

### Action Entry Point

The action entrypoint should be `src/index.ts` which imports and calls the main `run()` function:

```typescript
// src/index.ts
import { run } from './main.js';

run();
```

### Main Function Pattern

Use async/await with try-catch for the main action logic:

```typescript
// src/main.ts
import * as core from '@actions/core';

export async function run(): Promise<void> {
  try {
    // Get inputs
    const myInput = core.getInput('my-input', { required: true });

    // Action logic here
    core.debug(`Processing input: ${myInput}`);

    // Set outputs
    core.setOutput('result', 'success');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}
```

### Using @actions/core

Always use the `@actions/core` package for:

- Reading inputs: `core.getInput()`, `core.getBooleanInput()`, `core.getMultilineInput()`
- Setting outputs: `core.setOutput()`
- Logging: `core.debug()`, `core.info()`, `core.warning()`, `core.error()`, `core.notice()`
- Failing the action: `core.setFailed()`
- Grouping logs: `core.startGroup()`, `core.endGroup()`, `core.group()`
- Masking secrets: `core.setSecret()`
- Exporting variables: `core.exportVariable()`
- Adding to PATH: `core.addPath()`

### Using octokit

For GitHub API interactions, use the `octokit` package:

```typescript
import { Octokit } from 'octokit';

const octokit = new Octokit({ auth: token });
const context = github.context;
```

### File Extensions

Use `.js` extensions in import statements for ESM compatibility:

```typescript
import { myFunction } from './utils.js'; // ✓ Correct
import { myFunction } from './utils'; // ✗ Avoid
```

### Use modules

Split functionality into separate modules under `src/` for better organization and testability. Group related functions and types together.

## Testing Guidelines

### Test File Naming

- Place tests in `__tests__/` directory
- Name test files as `*.test.ts`

### Vitest Test Structure

```typescript
// __tests__/main.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('main', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should do something', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Mocking @actions/core

Create mock fixtures for the actions toolkit:

```typescript
// __fixtures__/core.ts
import { vi } from 'vitest';

export const getInput = vi.fn();
export const setOutput = vi.fn();
export const setFailed = vi.fn();
export const debug = vi.fn();
export const info = vi.fn();
export const warning = vi.fn();
export const error = vi.fn();
```

Use `vi.mock()` to mock modules:

```typescript
vi.mock('@actions/core', () => import('../__fixtures__/core.js'));
```

### Testing Environment Variables

Set `INPUT_*` environment variables to simulate action inputs:

```typescript
process.env['INPUT_MY-INPUT'] = 'test-value';
```

## Bundling

### Build Process

Always run the bundle before committing:

```bash
npm run bundle
```

The `dist/` directory must be committed to the repository as GitHub Actions runs directly from the
repository.

## Action Metadata (action.yml)

Define action metadata with proper inputs, outputs, and runtime:

```yaml
name: 'Action Name'
description: 'Action description'
author: 'Author Name'

branding:
  icon: 'check-circle'
  color: 'green'

inputs:
  my-input:
    description: 'Description of the input'
    required: true
    default: 'default-value'

outputs:
  result:
    description: 'Description of the output'

runs:
  using: 'node20'
  main: 'dist/index.js'
```

## Error Handling

- Always wrap main logic in try-catch
- Use `core.setFailed()` for fatal errors
- Use `core.warning()` for non-fatal issues
- Use `core.error()` for errors that should be highlighted but don't fail the action
- Provide meaningful error messages

```typescript
try {
  // Action logic
} catch (error) {
  if (error instanceof Error) {
    core.setFailed(`Action failed: ${error.message}`);
  } else {
    core.setFailed('Action failed with unknown error');
  }
}
```

## Versioning and Releases

- Use semantic versioning (vX.Y.Z)
- Maintain major version tags (v1, v2) pointing to latest minor/patch
- Create `releases/v#` branches for major versions
- Update package.json version field before releasing

## CI/CD Workflows

Include workflows for:

- **CI**: Lint, test, and build on pull requests
- **Check dist**: Verify dist/ is up to date with source changes
- **CodeQL**: Security analysis
- **Release**: Automate version tagging

## Dependencies

### Runtime Dependencies

Keep runtime dependencies minimal. All dependencies are bundled into `dist/index.js`.

Common packages:

- `@actions/core` - Core toolkit functions
- `octokit` - GitHub API client
- `@actions/exec` - Command execution
- `@actions/io` - File system operations
- `@actions/glob` - File globbing
- `@actions/tool-cache` - Tool download and caching
- `@actions/http-client` - HTTP requests
- `@actions/cache` - Workflow caching
- `@actions/artifact` - Artifact upload/download

### Dev Dependencies

- `typescript`
- `@vercel/ncc` for bundling
- `vitest` with `@vitest/coverage-v8`
- `eslint` with TypeScript plugins
- `prettier`

## Code Style

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use async/await over callbacks/promises
- Add JSDoc comments for exported functions
- Keep functions focused and small
- Use meaningful variable and function names

## Security Considerations

- Never log secrets or sensitive data
- Use `core.setSecret()` to mask sensitive values
- Validate and sanitize all inputs
- Be cautious with `exec` and shell commands
- Use minimal required permissions
- Always use specific NPM package references, do not use semver ranges for dependencies
