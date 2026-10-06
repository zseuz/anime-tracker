import { TestBed } from '@angular/core/testing';
import { KeyValueStore, Notifier } from '../domain/ports';
import { FakeNotifier, InMemoryStore } from '../testing/fakes';
import { NOTIFY_PREF_KEY, NotificationService } from './notification.service';

describe('NotificationService', () => {
  let notifier: FakeNotifier;
  let store: InMemoryStore;

  const create = () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Notifier, useValue: notifier },
        { provide: KeyValueStore, useValue: store },
      ],
    });
    return TestBed.inject(NotificationService);
  };

  beforeEach(() => {
    notifier = new FakeNotifier();
    store = new InMemoryStore();
  });

  it('is off by default and sends nothing', () => {
    const svc = create();
    expect(svc.enabled()).toBe(false);
    svc.notifyNewEpisodes('Frieren', 2);
    expect(notifier.sent).toEqual([]);
  });

  it('asks for permission when turned on, then notifies', async () => {
    const svc = create();
    await svc.toggle();
    expect(svc.enabled()).toBe(true);
    expect(store.get(NOTIFY_PREF_KEY, false)).toBe(true);
    svc.notifyNewEpisodes('Frieren', 1);
    svc.notifyNewEpisodes('Frieren', 3);
    expect(notifier.sent).toEqual([
      { title: 'Frieren', body: '1 capítulo nuevo disponible' },
      { title: 'Frieren', body: '3 capítulos nuevos disponibles' },
    ]);
  });

  it('stays off and reports blocked when the user denies permission', async () => {
    notifier.grantOnRequest = 'denied';
    const svc = create();
    await svc.toggle();
    expect(svc.enabled()).toBe(false);
    expect(svc.blocked()).toBe(true);
    expect(store.get(NOTIFY_PREF_KEY, true)).toBe(false);
  });

  it('can be turned off again', async () => {
    const svc = create();
    await svc.toggle();
    await svc.toggle();
    expect(svc.enabled()).toBe(false);
    svc.notifyNewEpisodes('Frieren', 1);
    expect(notifier.sent).toEqual([]);
  });

  it('remembers the preference but needs the browser permission too', () => {
    store.set(NOTIFY_PREF_KEY, true);
    notifier.state = 'default';
    expect(create().enabled()).toBe(false);
  });

  it('is unsupported when the browser has no Notification API', () => {
    notifier.state = 'unsupported';
    expect(create().supported()).toBe(false);
  });
});
