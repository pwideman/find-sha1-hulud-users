import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@actions/core', () => import('../__fixtures__/core'));

describe('github module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  describe('aggregateResults', () => {
    it('should aggregate repositories by user', async () => {
      const { aggregateResults } = await import('../src/github');

      const repositories = [
        { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
        { owner: 'user1', repo: 'repo2', url: 'https://github.com/user1/repo2' },
        { owner: 'user2', repo: 'repo3', url: 'https://github.com/user2/repo3' },
      ];

      const memberships = new Map();
      memberships.set('user1', {
        username: 'user1',
        organizations: new Map([['org1', 'member']]),
      });
      memberships.set('user2', {
        username: 'user2',
        organizations: new Map(),
      });

      const results = aggregateResults(repositories, memberships);

      expect(results).toHaveLength(2);
      // user1 has memberships, so should be first
      expect(results[0].username).toBe('user1');
      expect(results[0].repositories).toHaveLength(2);
      expect(results[0].memberships).toHaveLength(1);
      expect(results[0].memberships[0]).toEqual({ org: 'org1', type: 'member' });
      // user2 has no memberships
      expect(results[1].username).toBe('user2');
      expect(results[1].repositories).toHaveLength(1);
      expect(results[1].memberships).toHaveLength(0);
    });

    it('should sort results by number of memberships (most first)', async () => {
      const { aggregateResults } = await import('../src/github');

      const repositories = [
        { owner: 'userA', repo: 'repo1', url: 'https://github.com/userA/repo1' },
        { owner: 'userB', repo: 'repo2', url: 'https://github.com/userB/repo2' },
        { owner: 'userC', repo: 'repo3', url: 'https://github.com/userC/repo3' },
      ];

      const memberships = new Map();
      memberships.set('userA', {
        username: 'userA',
        organizations: new Map([['org1', 'member']]),
      });
      memberships.set('userB', {
        username: 'userB',
        organizations: new Map([
          ['org1', 'member'],
          ['org2', 'outside_collaborator'],
        ]),
      });
      memberships.set('userC', {
        username: 'userC',
        organizations: new Map(),
      });

      const results = aggregateResults(repositories, memberships);

      expect(results[0].username).toBe('userB'); // 2 memberships
      expect(results[1].username).toBe('userA'); // 1 membership
      expect(results[2].username).toBe('userC'); // 0 memberships
    });

    it('should handle users with no memberships data', async () => {
      const { aggregateResults } = await import('../src/github');

      const repositories = [
        { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
      ];

      const memberships = new Map(); // empty - user not found in membership map

      const results = aggregateResults(repositories, memberships);

      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('user1');
      expect(results[0].memberships).toHaveLength(0);
    });

    it('should sort alphabetically when memberships are equal', async () => {
      const { aggregateResults } = await import('../src/github');

      const repositories = [
        { owner: 'charlie', repo: 'repo1', url: 'https://github.com/charlie/repo1' },
        { owner: 'alice', repo: 'repo2', url: 'https://github.com/alice/repo2' },
        { owner: 'bob', repo: 'repo3', url: 'https://github.com/bob/repo3' },
      ];

      const memberships = new Map();
      // All have same number of memberships (0)
      memberships.set('charlie', { username: 'charlie', organizations: new Map() });
      memberships.set('alice', { username: 'alice', organizations: new Map() });
      memberships.set('bob', { username: 'bob', organizations: new Map() });

      const results = aggregateResults(repositories, memberships);

      expect(results[0].username).toBe('alice');
      expect(results[1].username).toBe('bob');
      expect(results[2].username).toBe('charlie');
    });

    it('should handle empty repositories array', async () => {
      const { aggregateResults } = await import('../src/github');

      const results = aggregateResults([], new Map());

      expect(results).toHaveLength(0);
    });

    it('should handle multiple repos for same user with multiple org memberships', async () => {
      const { aggregateResults } = await import('../src/github');

      const repositories = [
        { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
        { owner: 'user1', repo: 'repo2', url: 'https://github.com/user1/repo2' },
        { owner: 'user1', repo: 'repo3', url: 'https://github.com/user1/repo3' },
      ];

      const memberships = new Map();
      memberships.set('user1', {
        username: 'user1',
        organizations: new Map([
          ['org1', 'member'],
          ['org2', 'outside_collaborator'],
          ['org3', 'member'],
        ]),
      });

      const results = aggregateResults(repositories, memberships);

      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('user1');
      expect(results[0].repositories).toHaveLength(3);
      expect(results[0].memberships).toHaveLength(3);
    });
  });

  describe('getEnterpriseOrganizations', () => {
    it('should fetch organizations from enterprise', async () => {
      const orgIterator = async function* () {
        yield {
          enterprise: {
            organizations: {
              nodes: [{ login: 'org1' }, { login: 'org2' }],
            },
          },
        };
      };

      const collabIterator = async function* () {
        yield { data: [{ login: 'collab1' }] };
      };

      const mockOctokit = {
        graphql: {
          paginate: {
            iterator: vi.fn().mockReturnValue(orgIterator()),
          },
        },
        paginate: {
          iterator: vi.fn().mockReturnValue(collabIterator()),
        },
        rest: {
          orgs: {
            listOutsideCollaborators: vi.fn(),
          },
        },
      };

      const { getEnterpriseOrganizations } = await import('../src/github');
      const orgs = await getEnterpriseOrganizations(mockOctokit as never, 'test-enterprise');

      expect(orgs).toHaveLength(2);
      expect(orgs[0].login).toBe('org1');
      expect(orgs[1].login).toBe('org2');
    });

    it('should throw error when GraphQL fails', async () => {
      const mockOctokit = {
        graphql: {
          paginate: {
            iterator: vi.fn().mockImplementation(() => {
              throw new Error('GraphQL error');
            }),
          },
        },
      };

      const { getEnterpriseOrganizations } = await import('../src/github');

      await expect(
        getEnterpriseOrganizations(mockOctokit as never, 'test-enterprise'),
      ).rejects.toThrow('Failed to fetch enterprise organizations: GraphQL error');
    });

    it('should handle empty organizations response', async () => {
      const emptyOrgIterator = async function* () {
        yield {
          enterprise: {
            organizations: {
              nodes: [],
            },
          },
        };
      };

      const mockOctokit = {
        graphql: {
          paginate: {
            iterator: vi.fn().mockReturnValue(emptyOrgIterator()),
          },
        },
        paginate: {
          iterator: vi.fn(),
        },
        rest: {
          orgs: {
            listOutsideCollaborators: vi.fn(),
          },
        },
      };

      const { getEnterpriseOrganizations } = await import('../src/github');
      const orgs = await getEnterpriseOrganizations(mockOctokit as never, 'test-enterprise');

      expect(orgs).toHaveLength(0);
    });
  });

  describe('searchSha1HuludRepositories', () => {
    it('should search and return repositories', async () => {
      const repoIterator = async function* () {
        yield {
          data: [
            {
              owner: { login: 'user1' },
              name: 'repo1',
              html_url: 'https://github.com/user1/repo1',
            },
            {
              owner: { login: 'user2' },
              name: 'repo2',
              html_url: 'https://github.com/user2/repo2',
            },
          ],
        };
      };

      const mockOctokit = {
        paginate: {
          iterator: vi.fn().mockReturnValue(repoIterator()),
        },
        rest: {
          search: {
            repos: vi.fn(),
          },
        },
      };

      const { searchSha1HuludRepositories } = await import('../src/github');
      const repos = await searchSha1HuludRepositories(mockOctokit as never);

      expect(repos).toHaveLength(2);
      expect(repos[0]).toEqual({
        owner: 'user1',
        repo: 'repo1',
        url: 'https://github.com/user1/repo1',
      });
    });

    it('should skip repositories without owner', async () => {
      const repoIterator = async function* () {
        yield {
          data: [
            {
              owner: { login: 'user1' },
              name: 'repo1',
              html_url: 'https://github.com/user1/repo1',
            },
            { owner: null, name: 'repo2', html_url: 'https://github.com/unknown/repo2' },
          ],
        };
      };

      const mockOctokit = {
        paginate: {
          iterator: vi.fn().mockReturnValue(repoIterator()),
        },
        rest: {
          search: {
            repos: vi.fn(),
          },
        },
      };

      const { searchSha1HuludRepositories } = await import('../src/github');
      const repos = await searchSha1HuludRepositories(mockOctokit as never);

      expect(repos).toHaveLength(1);
      expect(repos[0].owner).toBe('user1');
    });

    it('should throw error when search fails', async () => {
      const mockOctokit = {
        paginate: {
          iterator: vi.fn().mockImplementation(() => {
            throw new Error('Search API error');
          }),
        },
        rest: {
          search: {
            repos: vi.fn(),
          },
        },
      };

      const { searchSha1HuludRepositories } = await import('../src/github');

      await expect(searchSha1HuludRepositories(mockOctokit as never)).rejects.toThrow(
        'Failed to search for Sha1-Hulud repositories: Search API error',
      );
    });

    it('should handle empty search results', async () => {
      const emptyIterator = async function* () {
        yield { data: [] };
      };

      const mockOctokit = {
        paginate: {
          iterator: vi.fn().mockReturnValue(emptyIterator()),
        },
        rest: {
          search: {
            repos: vi.fn(),
          },
        },
      };

      const { searchSha1HuludRepositories } = await import('../src/github');
      const repos = await searchSha1HuludRepositories(mockOctokit as never);

      expect(repos).toHaveLength(0);
    });
  });

  describe('checkUserMemberships', () => {
    it('should check memberships for users across organizations', async () => {
      const mockOctokit = {
        rest: {
          orgs: {
            checkMembershipForUser: vi.fn().mockResolvedValue({}),
          },
        },
      };

      const organizations = [
        { login: 'org1', outsideCollaborators: new Set<string>() },
        { login: 'org2', outsideCollaborators: new Set<string>() },
      ];

      const { checkUserMemberships } = await import('../src/github');
      const memberships = await checkUserMemberships(mockOctokit as never, organizations, [
        'user1',
      ]);

      expect(memberships.size).toBe(1);
      expect(memberships.get('user1')).toBeDefined();
      expect(memberships.get('user1')?.organizations.size).toBe(2);
    });

    it('should identify outside collaborators from cache', async () => {
      const mockOctokit = {
        rest: {
          orgs: {
            checkMembershipForUser: vi.fn().mockRejectedValue(new Error('Not a member')),
          },
        },
      };

      const organizations = [{ login: 'org1', outsideCollaborators: new Set(['user1']) }];

      const { checkUserMemberships } = await import('../src/github');
      const memberships = await checkUserMemberships(mockOctokit as never, organizations, [
        'user1',
      ]);

      expect(memberships.get('user1')?.organizations.get('org1')).toBe('outside_collaborator');
    });

    it('should handle duplicate usernames (case-insensitive)', async () => {
      const mockOctokit = {
        rest: {
          orgs: {
            checkMembershipForUser: vi.fn().mockResolvedValue({}),
          },
        },
      };

      const organizations = [{ login: 'org1', outsideCollaborators: new Set<string>() }];

      const { checkUserMemberships } = await import('../src/github');
      const memberships = await checkUserMemberships(
        mockOctokit as never,
        organizations,
        ['user1', 'user1', 'USER1'], // duplicates (case-insensitive)
      );

      // Only one user should be processed
      expect(memberships.size).toBe(1);
    });

    it('should return none for users not in any organization', async () => {
      const mockOctokit = {
        rest: {
          orgs: {
            checkMembershipForUser: vi.fn().mockRejectedValue(new Error('Not a member')),
          },
        },
      };

      const organizations = [{ login: 'org1', outsideCollaborators: new Set<string>() }];

      const { checkUserMemberships } = await import('../src/github');
      const memberships = await checkUserMemberships(mockOctokit as never, organizations, [
        'user1',
      ]);

      expect(memberships.get('user1')?.organizations.size).toBe(0);
    });

    it('should handle empty usernames array', async () => {
      const mockOctokit = {
        rest: {
          orgs: {
            checkMembershipForUser: vi.fn(),
          },
        },
      };

      const organizations = [{ login: 'org1', outsideCollaborators: new Set<string>() }];

      const { checkUserMemberships } = await import('../src/github');
      const memberships = await checkUserMemberships(mockOctokit as never, organizations, []);

      expect(memberships.size).toBe(0);
    });

    it('should handle empty organizations array', async () => {
      const mockOctokit = {
        rest: {
          orgs: {
            checkMembershipForUser: vi.fn(),
          },
        },
      };

      const { checkUserMemberships } = await import('../src/github');
      const memberships = await checkUserMemberships(mockOctokit as never, [], ['user1']);

      expect(memberships.size).toBe(1);
      expect(memberships.get('user1')?.organizations.size).toBe(0);
    });
  });
});
