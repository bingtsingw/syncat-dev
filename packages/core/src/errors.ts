export class SyncatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncatError';
  }
}
