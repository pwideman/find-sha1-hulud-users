import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as core from '../__fixtures__/core';

vi.mock('@actions/core', () => import('../__fixtures__/core'));

describe('main', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should log a message when run is called', async () => {
    const { run } = await import('../src/main');

    await run();

    expect(core.info).toHaveBeenCalledWith('Hello from the find-sha1-hulud-users action!');
    expect(core.setFailed).not.toHaveBeenCalled();
  });
});
