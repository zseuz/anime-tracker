import { TestBed } from '@angular/core/testing';
import { AnimeCatalog } from '../domain/ports';
import { FakeCatalog, makeEpisodes } from '../testing/fakes';
import { EpisodesService } from './episodes.service';

describe('EpisodesService', () => {
  let catalog: FakeCatalog;
  let service: EpisodesService;

  beforeEach(() => {
    catalog = new FakeCatalog();
    TestBed.configureTestingModule({ providers: [{ provide: AnimeCatalog, useValue: catalog }] });
    service = TestBed.inject(EpisodesService);
  });

  it('lists the released episodes', async () => {
    catalog.episodeLists.set(1, makeEpisodes(3));
    expect((await service.list(1)).map(e => e.number)).toEqual([1, 2, 3]);
  });

  it('counts the released episodes', async () => {
    catalog.episodeLists.set(1, makeEpisodes(12));
    expect(await service.count(1)).toBe(12);
  });

  it('is empty for a series without releases', async () => {
    expect(await service.list(99)).toEqual([]);
    expect(await service.count(99)).toBe(0);
  });
});
