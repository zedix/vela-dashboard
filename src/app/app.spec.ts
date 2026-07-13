import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App shell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
  });

  it('renders the brand as a home link', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const link = fixture.nativeElement.querySelector('header a') as HTMLAnchorElement | null;

    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/');
    expect(link?.querySelector('vela-logo')?.getAttribute('aria-label')).toBe('Vela');
  });

  it('keeps a router-outlet for feature routes', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });
});
