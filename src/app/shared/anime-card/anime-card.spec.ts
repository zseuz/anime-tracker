import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { makeAnime, makeTracked } from '../../testing/fakes';
import { AnimeCard } from './anime-card';

describe('AnimeCard', () => {
  let fixture: ComponentFixture<AnimeCard>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(AnimeCard);
  });

  it('shows title, score and episode count', async () => {
    fixture.componentRef.setInput('anime', makeAnime({ score: 8.5, episodes: null }));
    await fixture.whenStable();
    expect(el().textContent).toContain('Frieren');
    expect(el().textContent).toContain('8.5');
    expect(el().textContent).toContain('? ep');
    expect(el().querySelector('.in-list')).toBeNull();
    expect(el().querySelector('.next')).toBeNull();
  });

  it('shows the next scheduled episode', async () => {
    const inThreeDays = Math.floor(Date.now() / 1000) + 3 * 86400 + 600;
    fixture.componentRef.setInput('anime', makeAnime({ nextEpisode: { number: 8, airingAt: inThreeDays } }));
    await fixture.whenStable();
    expect(el().querySelector('.next')?.textContent).toContain('Ep. 8 · en 3 días');
  });

  it('shows status and progress when the anime is in the list', async () => {
    fixture.componentRef.setInput('anime', makeAnime());
    fixture.componentRef.setInput('tracked', makeTracked({ watched: [1, 2], status: 'completed' }));
    await fixture.whenStable();
    expect(el().querySelector('.in-list')?.textContent).toContain('Completado · 2 vistos');
  });

  it('flags new episodes', async () => {
    fixture.componentRef.setInput('anime', makeAnime());
    fixture.componentRef.setInput('tracked', makeTracked({ newEpisodes: 2 }));
    await fixture.whenStable();
    expect(el().querySelector('.new')).not.toBeNull();
  });
});
