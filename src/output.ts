import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import type { SearchResult, UserResult } from './github.js';

export interface SummaryStats {
  totalRepositories: number;
  uniqueUsers: number;
  usersWithMemberships: number;
  totalMemberships: number;
}

/**
 * Escapes HTML special characters to prevent XSS in workflow summaries.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function calculateStats(results: UserResult[]): SummaryStats {
  let totalRepositories = 0;
  let usersWithMemberships = 0;
  let totalMemberships = 0;

  for (const user of results) {
    totalRepositories += user.repositories.length;
    if (user.memberships.length > 0) {
      usersWithMemberships++;
      totalMemberships += user.memberships.length;
    }
  }

  return {
    totalRepositories,
    uniqueUsers: results.length,
    usersWithMemberships,
    totalMemberships,
  };
}

export async function writeSummary(results: UserResult[], stats: SummaryStats): Promise<void> {
  core.info('Writing workflow summary...');

  // Add header
  await core.summary.addHeading('Sha1-Hulud User Scan Results', 1).write();

  // Add statistics
  await core.summary.addHeading('Statistics', 2).write();
  await core.summary
    .addTable([
      [
        { data: 'Metric', header: true },
        { data: 'Value', header: true },
      ],
      ['Total Sha1-Hulud Repositories Found', stats.totalRepositories.toString()],
      ['Unique Users with Sha1-Hulud Repos', stats.uniqueUsers.toString()],
      ['Users with Enterprise Memberships', stats.usersWithMemberships.toString()],
      ['Total Memberships Found', stats.totalMemberships.toString()],
    ])
    .write();

  // Add user table if there are results
  if (results.length > 0) {
    await core.summary.addHeading('Users with Sha1-Hulud Repositories', 2).write();

    const tableRows: ({ data: string; header: true } | string)[][] = [
      [
        { data: 'Username', header: true },
        { data: 'Repositories', header: true },
        { data: 'Enterprise Memberships', header: true },
      ],
    ];

    for (const user of results) {
      const escapedUsername = escapeHtml(user.username);
      const repoLinks = user.repositories
        .map((r) => `<a href="${escapeHtml(r.url)}">${escapeHtml(r.repo)}</a>`)
        .join(', ');

      const memberships =
        user.memberships.length > 0
          ? user.memberships.map((m) => `${escapeHtml(m.org)} (${escapeHtml(m.type)})`).join(', ')
          : 'None';

      tableRows.push([
        `<a href="https://github.com/${escapedUsername}">${escapedUsername}</a>`,
        repoLinks,
        memberships,
      ]);
    }

    await core.summary.addTable(tableRows).write();
  } else {
    await core.summary.addRaw('No users with Sha1-Hulud repositories found.').write();
  }

  core.info('Workflow summary written successfully');
}

function escapeCSV(value: string): string {
  // If the value contains comma, newline, or double quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatRepositoriesForCSV(repos: SearchResult[]): string {
  return repos.map((r) => r.url).join('; ');
}

export function generateCSVContent(results: UserResult[]): string {
  const headers = [
    'Username',
    'Profile URL',
    'Repository Count',
    'Repositories',
    'Has Enterprise Membership',
    'Memberships',
  ];

  const rows = results.map((user) => [
    escapeCSV(user.username),
    escapeCSV(`https://github.com/${user.username}`),
    user.repositories.length.toString(),
    escapeCSV(formatRepositoriesForCSV(user.repositories)),
    user.memberships.length > 0 ? 'Yes' : 'No',
    escapeCSV(user.memberships.map((m) => `${m.org} (${m.type})`).join('; ')),
  ]);

  const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];
  return csvLines.join('\n');
}

const CSV_FILENAME = 'sha1-hulud-users.csv';

export function writeCSVToOutputDir(results: UserResult[], outputDir: string): void {
  core.info('Generating CSV output...');

  const csvContent = generateCSVContent(results);

  // Resolve the directory (handles both absolute and relative paths)
  const resolvedDir = path.resolve(outputDir);
  const csvPath = path.join(resolvedDir, CSV_FILENAME);

  // Create directory if it doesn't exist
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
    core.info(`Created directory: ${resolvedDir}`);
  }

  // Write CSV to output directory
  fs.writeFileSync(csvPath, csvContent, 'utf-8');

  core.info(`CSV file written to ${csvPath}`);
}
