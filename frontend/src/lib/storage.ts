export function getStoredFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function setStoredFlag(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Restricted storage should not block the main transcription workflow.
  }
}
