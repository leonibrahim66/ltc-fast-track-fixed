/**
 * Minimal mock for expo-linking in the Vitest node environment.
 */
export function createURL(path: string): string {
  return `exp://localhost/${path}`;
}

export function openURL(url: string): Promise<void> {
  return Promise.resolve();
}

export function canOpenURL(url: string): Promise<boolean> {
  return Promise.resolve(true);
}

export function getInitialURL(): Promise<string | null> {
  return Promise.resolve(null);
}

export function addEventListener(
  type: string,
  handler: (event: { url: string }) => void
): { remove: () => void } {
  return { remove: () => {} };
}

export function parse(url: string) {
  return { path: url, queryParams: {} };
}

export default {
  createURL,
  openURL,
  canOpenURL,
  getInitialURL,
  addEventListener,
  parse,
};
