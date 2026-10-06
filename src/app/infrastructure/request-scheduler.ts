const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Runs async tasks one at a time, leaving a gap between them (API rate limiting). */
export class RequestScheduler {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly gapMs: number) {}

  schedule<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.then(() => sleep(this.gapMs), () => sleep(this.gapMs));
    return result;
  }
}
