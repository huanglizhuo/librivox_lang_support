export class SyncError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SyncError';
  }
}

export class LibriVoxApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'LibriVoxApiError';
  }
}
