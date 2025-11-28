import * as core from '@actions/core';

export async function run(): Promise<void> {
  try {
    core.info('Hello from the find-sha1-hulud-users action!');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}
