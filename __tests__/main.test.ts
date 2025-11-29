import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as core from '../__fixtures__/core';

// Mock all external dependencies
vi.mock('@actions/core', () => import('../__fixtures__/core'));

describe('main', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    core.resetSummaryMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should be defined', async () => {
    const mainModule = await import('../src/main');
    expect(mainModule.run).toBeDefined();
    expect(typeof mainModule.run).toBe('function');
  });

  it('should have run function that is async', async () => {
    const mainModule = await import('../src/main');
    // Check that run returns a promise
    const result = mainModule.run();
    expect(result).toBeInstanceOf(Promise);
    // We can't fully test the function without complex mocking,
    // but we verify the function signature is correct
  });
});
