import { vi } from 'vitest';

// Mock Octokit paginate iterator
const createPaginateIterator = (data: unknown[]) => {
  return async function* () {
    yield { data };
  };
};

// Default mock functions
export const mockGraphqlPaginateIterator = vi.fn();
export const mockSearchRepos = vi.fn();
export const mockCheckMembershipForUser = vi.fn();
export const mockCheckPublicMembershipForUser = vi.fn();
export const mockListOutsideCollaborators = vi.fn();

// Create a mock Octokit instance
export const createMockOctokit = () => ({
  graphql: {
    paginate: {
      iterator: mockGraphqlPaginateIterator,
    },
  },
  paginate: {
    iterator: vi.fn(() => {
      // Return an async iterator based on what function is being called
      return createPaginateIterator([])();
    }),
  },
  rest: {
    search: {
      repos: mockSearchRepos,
    },
    orgs: {
      checkMembershipForUser: mockCheckMembershipForUser,
      checkPublicMembershipForUser: mockCheckPublicMembershipForUser,
      listOutsideCollaborators: mockListOutsideCollaborators,
    },
  },
});

// Export the Octokit class mock
export const Octokit = vi.fn().mockImplementation(() => createMockOctokit());
