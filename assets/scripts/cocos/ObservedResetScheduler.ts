export class ObservedResetScheduler {
  private readonly timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly onExpire: () => void,
    private readonly scheduleTimeout: typeof setTimeout = setTimeout,
    private readonly cancelTimeout: typeof clearTimeout = clearTimeout
  ) {}

  schedule(key: string, delayMs: number): void {
    const existing = this.timeouts.get(key);
    if (existing !== undefined) {
      this.cancelTimeout(existing);
    }

    const timeout = this.scheduleTimeout(() => {
      if (this.timeouts.get(key) !== timeout) {
        return;
      }

      this.timeouts.delete(key);
      this.onExpire();
    }, delayMs);

    this.timeouts.set(key, timeout);
  }

  clearAll(): void {
    for (const timeout of this.timeouts.values()) {
      this.cancelTimeout(timeout);
    }

    this.timeouts.clear();
  }

  getPendingKeys(): string[] {
    return [...this.timeouts.keys()];
  }
}
