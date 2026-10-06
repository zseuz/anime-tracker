import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Breadcrumbs } from './breadcrumbs';

describe('Breadcrumbs', () => {
  let fixture: ComponentFixture<Breadcrumbs>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Breadcrumbs);
  });

  it('links every crumb except the last, which is the current page', async () => {
    fixture.componentRef.setInput('items', [
      { label: 'Mi lista', link: '/mi-lista' },
      { label: 'Frieren' },
    ]);
    await fixture.whenStable();
    const links = el().querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toContain('Mi lista');
    expect(links[0].getAttribute('href')).toBe('/mi-lista');
    expect(el().querySelector('[aria-current="page"]')?.textContent).toContain('Frieren');
  });

  it('never links the last crumb even if it has a link', async () => {
    fixture.componentRef.setInput('items', [{ label: 'Explorar', link: '/' }, { label: 'X', link: '/x' }]);
    await fixture.whenStable();
    expect(el().querySelectorAll('a')).toHaveLength(1);
  });

  it('exposes a labelled navigation landmark', async () => {
    fixture.componentRef.setInput('items', [{ label: 'Solo' }]);
    await fixture.whenStable();
    expect(el().querySelector('nav')?.getAttribute('aria-label')).toBe('Migas de pan');
  });
});
