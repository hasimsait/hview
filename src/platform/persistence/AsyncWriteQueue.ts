/** Serializes writes and always releases the next operation after a failure. */
export class AsyncWriteQueue {
  private tail: Promise<void> | null = null;
  async run<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    this.tail = current;
    if (previous) await previous;
    try { return await operation(); }
    finally { if (this.tail === current) this.tail = null; release(); }
  }
}
