import { RequestScheduler } from './request-scheduler';

describe('RequestScheduler', () => {
  it('runs tasks sequentially, in order', async () => {
    const s = new RequestScheduler(0);
    const log: string[] = [];
    const task = (name: string, ms: number) => async () => {
      log.push(`start ${name}`);
      await new Promise(r => setTimeout(r, ms));
      log.push(`end ${name}`);
      return name;
    };
    const results = await Promise.all([s.schedule(task('a', 20)), s.schedule(task('b', 1))]);
    expect(results).toEqual(['a', 'b']);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b']);
  });

  it('keeps going after a failed task', async () => {
    const s = new RequestScheduler(0);
    const failing = s.schedule(() => Promise.reject(new Error('x')));
    const next = s.schedule(() => Promise.resolve('ok'));
    await expect(failing).rejects.toThrow('x');
    await expect(next).resolves.toBe('ok');
  });

  it('waits the configured gap between tasks', async () => {
    const s = new RequestScheduler(30);
    const times: number[] = [];
    const stamp = () => { times.push(Date.now()); return Promise.resolve(); };
    await Promise.all([s.schedule(stamp), s.schedule(stamp)]);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(25);
  });
});
