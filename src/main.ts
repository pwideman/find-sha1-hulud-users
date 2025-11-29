import * as core from '@actions/core';
import { Octokit } from 'octokit';
import {
  aggregateResults,
  checkUserMemberships,
  getEnterpriseOrganizations,
  searchSha1HuludRepositories,
} from './github.js';
import { calculateStats, writeCSVToOutputDir, writeSummary } from './output.js';

export async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const enterprise = core.getInput('enterprise', { required: true });
    const outputDir = core.getInput('output-dir') || '.';

    core.info('Starting Sha1-Hulud user scan...');

    // Create Octokit client
    const octokit = new Octokit({ auth: token });

    // Step 1: Get all organizations in the enterprise
    const organizations = await getEnterpriseOrganizations(octokit, enterprise);

    if (organizations.length === 0) {
      core.warning('No organizations found in enterprise');
    }

    // Step 2: Search for Sha1-Hulud repositories
    const repositories = await searchSha1HuludRepositories(octokit);

    if (repositories.length === 0) {
      core.info('No Sha1-Hulud repositories found');
    }

    // Step 3: Check user memberships across all organizations
    const usernames = repositories.map((r) => r.owner);
    const memberships = await checkUserMemberships(octokit, organizations, usernames);

    // Step 4: Aggregate results
    const allResults = aggregateResults(repositories, memberships);

    // Filter to only include users with enterprise memberships
    const usersWithMemberships = allResults.filter((user) => user.memberships.length > 0);
    const stats = calculateStats(allResults);

    // Step 5: Write summary (only users with memberships)
    await writeSummary(usersWithMemberships, stats);

    // Step 6: Write CSV to output directory (only users with memberships)
    writeCSVToOutputDir(usersWithMemberships, outputDir);

    // Set outputs
    core.setOutput('users-found', stats.usersWithMemberships);
    core.setOutput('repos-found', stats.totalRepositories);

    core.info('Sha1-Hulud user scan completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}
