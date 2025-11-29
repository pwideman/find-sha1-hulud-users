import { Octokit } from 'octokit';
import * as core from '@actions/core';

// Search query to find Sha1-Hulud worm repositories
const SEARCH_QUERY = 'Sha1-Hulud: The Second Coming';

export interface SearchResult {
  owner: string;
  repo: string;
  url: string;
}

export interface UserMembership {
  username: string;
  organizations: Map<string, MembershipType>;
}

export type MembershipType = 'member' | 'outside_collaborator' | 'none';

export interface OrganizationInfo {
  login: string;
  outsideCollaborators: Set<string>;
}

export interface UserResult {
  username: string;
  repositories: SearchResult[];
  memberships: { org: string; type: MembershipType }[];
}

async function fetchOutsideCollaborators(octokit: Octokit, org: string): Promise<Set<string>> {
  const collaborators = new Set<string>();

  try {
    const iterator = octokit.paginate.iterator(octokit.rest.orgs.listOutsideCollaborators, {
      org,
      per_page: 100,
    });

    for await (const response of iterator) {
      for (const collaborator of response.data) {
        collaborators.add(collaborator.login.toLowerCase());
      }
    }
  } catch {
    // If we can't fetch collaborators, return empty set
    core.debug(`Could not fetch outside collaborators for org: ${org}`);
  }

  return collaborators;
}

export async function getEnterpriseOrganizations(
  octokit: Octokit,
  enterprise: string,
): Promise<OrganizationInfo[]> {
  const organizations: OrganizationInfo[] = [];

  core.info(`Fetching organizations for enterprise: ${enterprise}`);

  try {
    const iterator = octokit.graphql.paginate.iterator<{
      enterprise: {
        organizations: {
          nodes: { login: string }[];
          pageInfo: { hasNextPage: boolean; endCursor: string };
        };
      };
    }>(
      `
      query($enterprise: String!, $cursor: String) {
        enterprise(slug: $enterprise) {
          organizations(first: 100, after: $cursor) {
            nodes {
              login
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `,
      { enterprise },
    );

    const orgLogins: string[] = [];
    for await (const response of iterator) {
      const nodes = response.enterprise?.organizations?.nodes ?? [];
      for (const org of nodes) {
        orgLogins.push(org.login);
      }
    }

    core.info(`Found ${orgLogins.length} organizations in enterprise`);
    core.info('Fetching outside collaborators for all organizations...');

    // Fetch outside collaborators for all organizations concurrently
    const collaboratorPromises = orgLogins.map(async (login) => {
      const outsideCollaborators = await fetchOutsideCollaborators(octokit, login);
      return { login, outsideCollaborators };
    });

    const results = await Promise.all(collaboratorPromises);
    organizations.push(...results);

    const totalCollaborators = organizations.reduce(
      (sum, org) => sum + org.outsideCollaborators.size,
      0,
    );
    core.info(`Cached ${totalCollaborators} outside collaborators across all organizations`);

    return organizations;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to fetch enterprise organizations: ${message}`);
  }
}

export async function searchSha1HuludRepositories(octokit: Octokit): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  core.info(`Searching for Sha1-Hulud repositories...`);

  try {
    const iterator = octokit.paginate.iterator(octokit.rest.search.repos, {
      q: SEARCH_QUERY,
      per_page: 100,
    });

    for await (const response of iterator) {
      for (const repo of response.data) {
        if (repo.owner) {
          results.push({
            owner: repo.owner.login,
            repo: repo.name,
            url: repo.html_url,
          });
        }
      }
    }

    core.info(`Found ${results.length} Sha1-Hulud repositories`);
    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to search for Sha1-Hulud repositories: ${message}`);
  }
}

async function checkUserMembershipInOrg(
  octokit: Octokit,
  org: OrganizationInfo,
  username: string,
): Promise<MembershipType> {
  try {
    // Check if user is a member (this checks both public and private membership)
    await octokit.rest.orgs.checkMembershipForUser({ org: org.login, username });
    return 'member';
  } catch {
    // Not a member, check cached outside collaborators
    if (org.outsideCollaborators.has(username.toLowerCase())) {
      return 'outside_collaborator';
    }
    return 'none';
  }
}

export async function checkUserMemberships(
  octokit: Octokit,
  organizations: OrganizationInfo[],
  usernames: string[],
): Promise<Map<string, UserMembership>> {
  const userMemberships = new Map<string, UserMembership>();
  const userCache = new Set<string>();

  core.info(
    `Checking memberships for ${usernames.length} users across ${organizations.length} organizations...`,
  );

  // Filter unique usernames
  const uniqueUsernames = [...new Set(usernames)];

  // Process all users
  const membershipPromises: Promise<void>[] = [];

  for (const username of uniqueUsernames) {
    if (userCache.has(username.toLowerCase())) {
      continue;
    }
    userCache.add(username.toLowerCase());

    const userMembership: UserMembership = {
      username,
      organizations: new Map(),
    };

    // Check membership in all organizations concurrently
    const orgPromises = organizations.map(async (org) => {
      const membership = await checkUserMembershipInOrg(octokit, org, username);
      if (membership !== 'none') {
        userMembership.organizations.set(org.login, membership);
      }
    });

    membershipPromises.push(
      Promise.all(orgPromises).then(() => {
        userMemberships.set(username, userMembership);
      }),
    );
  }

  await Promise.all(membershipPromises);

  core.info(`Completed membership checks for ${uniqueUsernames.length} users`);
  return userMemberships;
}

export function aggregateResults(
  repositories: SearchResult[],
  memberships: Map<string, UserMembership>,
): UserResult[] {
  const userRepos = new Map<string, SearchResult[]>();

  // Group repositories by owner
  for (const repo of repositories) {
    const existing = userRepos.get(repo.owner) ?? [];
    existing.push(repo);
    userRepos.set(repo.owner, existing);
  }

  // Build results
  const results: UserResult[] = [];
  for (const [username, repos] of userRepos) {
    const membership = memberships.get(username);
    const membershipList: { org: string; type: MembershipType }[] = [];

    if (membership) {
      for (const [org, type] of membership.organizations) {
        membershipList.push({ org, type });
      }
    }

    results.push({
      username,
      repositories: repos,
      memberships: membershipList,
    });
  }

  // Sort by number of memberships (most first), then by username
  results.sort((a, b) => {
    if (b.memberships.length !== a.memberships.length) {
      return b.memberships.length - a.memberships.length;
    }
    return a.username.localeCompare(b.username);
  });

  return results;
}
