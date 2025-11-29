import { vi } from 'vitest';

export const getInput = vi.fn();
export const getBooleanInput = vi.fn();
export const getMultilineInput = vi.fn();
export const setOutput = vi.fn();
export const setFailed = vi.fn();
export const debug = vi.fn();
export const info = vi.fn();
export const warning = vi.fn();
export const error = vi.fn();
export const notice = vi.fn();
export const startGroup = vi.fn();
export const endGroup = vi.fn();
export const group = vi.fn();
export const setSecret = vi.fn();
export const exportVariable = vi.fn();
export const addPath = vi.fn();

// Create mock summary object with chainable methods
// We use a function that returns the object itself for chaining
const summaryMethods = {
  addHeading: vi.fn(),
  addTable: vi.fn(),
  addRaw: vi.fn(),
  write: vi.fn(),
};

// Set up return values for chaining
summaryMethods.addHeading.mockImplementation(() => summaryMethods);
summaryMethods.addTable.mockImplementation(() => summaryMethods);
summaryMethods.addRaw.mockImplementation(() => summaryMethods);
summaryMethods.write.mockImplementation(() => Promise.resolve(summaryMethods));

export const summary = summaryMethods;

export function resetSummaryMocks() {
  summaryMethods.addHeading.mockClear();
  summaryMethods.addTable.mockClear();
  summaryMethods.addRaw.mockClear();
  summaryMethods.write.mockClear();
  summaryMethods.addHeading.mockImplementation(() => summaryMethods);
  summaryMethods.addTable.mockImplementation(() => summaryMethods);
  summaryMethods.addRaw.mockImplementation(() => summaryMethods);
  summaryMethods.write.mockImplementation(() => Promise.resolve(summaryMethods));
}
