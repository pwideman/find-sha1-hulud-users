import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('output module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('calculateStats', () => {
    it('should calculate correct statistics', async () => {
      const { calculateStats } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [
            { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
            { owner: 'user1', repo: 'repo2', url: 'https://github.com/user1/repo2' },
          ],
          memberships: [{ org: 'org1', type: 'member' as const }],
        },
        {
          username: 'user2',
          repositories: [{ owner: 'user2', repo: 'repo3', url: 'https://github.com/user2/repo3' }],
          memberships: [],
        },
      ];

      const stats = calculateStats(results);

      expect(stats.totalRepositories).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
      expect(stats.usersWithMemberships).toBe(1);
      expect(stats.totalMemberships).toBe(1);
    });

    it('should handle empty results', async () => {
      const { calculateStats } = await import('../src/output');

      const stats = calculateStats([]);

      expect(stats.totalRepositories).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.usersWithMemberships).toBe(0);
      expect(stats.totalMemberships).toBe(0);
    });

    it('should count multiple memberships per user', async () => {
      const { calculateStats } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [{ owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' }],
          memberships: [
            { org: 'org1', type: 'member' as const },
            { org: 'org2', type: 'outside_collaborator' as const },
          ],
        },
      ];

      const stats = calculateStats(results);

      expect(stats.usersWithMemberships).toBe(1);
      expect(stats.totalMemberships).toBe(2);
    });

    it('should count users without memberships correctly', async () => {
      const { calculateStats } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [{ owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' }],
          memberships: [],
        },
        {
          username: 'user2',
          repositories: [{ owner: 'user2', repo: 'repo2', url: 'https://github.com/user2/repo2' }],
          memberships: [],
        },
      ];

      const stats = calculateStats(results);

      expect(stats.uniqueUsers).toBe(2);
      expect(stats.usersWithMemberships).toBe(0);
      expect(stats.totalMemberships).toBe(0);
    });
  });

  describe('generateCSVContent', () => {
    it('should generate correct CSV content', async () => {
      const { generateCSVContent } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [{ owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' }],
          memberships: [{ org: 'org1', type: 'member' as const }],
        },
      ];

      const csv = generateCSVContent(results);

      expect(csv).toContain('Username,Profile URL,Repository Count,Repositories,Memberships');
      expect(csv).toContain('user1');
      expect(csv).toContain('https://github.com/user1');
      expect(csv).toContain('org1 (member)');
    });

    it('should escape values with commas', async () => {
      const { generateCSVContent } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [
            { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
            { owner: 'user1', repo: 'repo2', url: 'https://github.com/user1/repo2' },
          ],
          memberships: [
            { org: 'org1', type: 'member' as const },
            { org: 'org2', type: 'outside_collaborator' as const },
          ],
        },
      ];

      const csv = generateCSVContent(results);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2); // header + 1 data row
      // The memberships should be quoted due to semicolons
      expect(lines[1]).toContain('org1 (member); org2 (outside_collaborator)');
    });

    it('should handle empty results', async () => {
      const { generateCSVContent } = await import('../src/output');

      const csv = generateCSVContent([]);

      expect(csv).toBe('Username,Profile URL,Repository Count,Repositories,Memberships');
    });

    it('should escape values with quotes', async () => {
      const { generateCSVContent } = await import('../src/output');

      const results = [
        {
          username: 'user"name',
          repositories: [
            { owner: 'user"name', repo: 'repo1', url: 'https://github.com/user"name/repo1' },
          ],
          memberships: [{ org: 'org1', type: 'member' as const }],
        },
      ];

      const csv = generateCSVContent(results);
      // Quotes should be escaped by doubling them
      expect(csv).toContain('""');
    });

    it('should escape values with newlines', async () => {
      const { generateCSVContent } = await import('../src/output');

      const results = [
        {
          username: 'user\nname',
          repositories: [
            { owner: 'user\nname', repo: 'repo1', url: 'https://github.com/username/repo1' },
          ],
          memberships: [{ org: 'org1', type: 'member' as const }],
        },
      ];

      const csv = generateCSVContent(results);
      // Values with newlines should be wrapped in quotes
      expect(csv).toContain('"user\nname"');
    });

    it('should include repository count', async () => {
      const { generateCSVContent } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [
            { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
            { owner: 'user1', repo: 'repo2', url: 'https://github.com/user1/repo2' },
            { owner: 'user1', repo: 'repo3', url: 'https://github.com/user1/repo3' },
          ],
          memberships: [{ org: 'org1', type: 'member' as const }],
        },
      ];

      const csv = generateCSVContent(results);
      // Should contain '3' for repository count
      expect(csv).toContain(',3,');
    });

    it('should format repository URLs with semicolons', async () => {
      const { generateCSVContent } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [
            { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
            { owner: 'user1', repo: 'repo2', url: 'https://github.com/user1/repo2' },
          ],
          memberships: [{ org: 'org1', type: 'member' as const }],
        },
      ];

      const csv = generateCSVContent(results);
      expect(csv).toContain('https://github.com/user1/repo1; https://github.com/user1/repo2');
    });
  });

  describe('writeCSVToOutputDir', () => {
    const testDir = '/tmp/test-csv-output-' + Date.now();

    beforeEach(() => {
      // Clean up test directory if it exists
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    });

    afterEach(() => {
      // Clean up test directory
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    });

    it('should write CSV file to output directory', async () => {
      vi.mock('@actions/core', () => import('../__fixtures__/core'));
      const { writeCSVToOutputDir } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [{ owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' }],
          memberships: [{ org: 'org1', type: 'member' as const }],
        },
      ];

      writeCSVToOutputDir(results, testDir);

      const csvPath = path.join(testDir, 'sha1-hulud-users.csv');
      expect(fs.existsSync(csvPath)).toBe(true);

      const content = fs.readFileSync(csvPath, 'utf-8');
      expect(content).toContain('Username,Profile URL');
      expect(content).toContain('user1');
    });

    it('should create directory if it does not exist', async () => {
      vi.mock('@actions/core', () => import('../__fixtures__/core'));
      const { writeCSVToOutputDir } = await import('../src/output');

      const nestedDir = path.join(testDir, 'nested', 'dir');

      writeCSVToOutputDir([], nestedDir);

      expect(fs.existsSync(nestedDir)).toBe(true);
    });

    it('should handle empty results', async () => {
      vi.mock('@actions/core', () => import('../__fixtures__/core'));
      const { writeCSVToOutputDir } = await import('../src/output');

      writeCSVToOutputDir([], testDir);

      const csvPath = path.join(testDir, 'sha1-hulud-users.csv');
      expect(fs.existsSync(csvPath)).toBe(true);

      const content = fs.readFileSync(csvPath, 'utf-8');
      // Should only contain headers
      expect(content).toBe('Username,Profile URL,Repository Count,Repositories,Memberships');
    });

    it('should write correct content to CSV file', async () => {
      vi.mock('@actions/core', () => import('../__fixtures__/core'));
      const { writeCSVToOutputDir } = await import('../src/output');

      const results = [
        {
          username: 'testuser',
          repositories: [
            {
              owner: 'testuser',
              repo: 'infected-repo',
              url: 'https://github.com/testuser/infected-repo',
            },
          ],
          memberships: [{ org: 'myorg', type: 'member' as const }],
        },
      ];

      writeCSVToOutputDir(results, testDir);

      const csvPath = path.join(testDir, 'sha1-hulud-users.csv');
      const content = fs.readFileSync(csvPath, 'utf-8');

      expect(content).toContain('testuser');
      expect(content).toContain('https://github.com/testuser');
      expect(content).toContain('https://github.com/testuser/infected-repo');
      expect(content).toContain('myorg (member)');
    });
  });
});
