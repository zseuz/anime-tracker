import { nextEpisodeLabel, untilAiring } from './schedule';

const NOW = 1_700_000_000_000; // ms
const at = (secondsFromNow: number) => NOW / 1000 + secondsFromNow;

describe('untilAiring', () => {
  it.each([
    [-10, 'ya disponible'],
    [0, 'ya disponible'],
    [30 * 60, 'en menos de 1 h'],
    [5 * 3600 + 120, 'en 5 h'],
    [26 * 3600, 'en 1 día'],
    [3 * 86400 + 5000, 'en 3 días'],
  ])('%i s from now -> %s', (seconds, expected) => {
    expect(untilAiring(at(seconds), NOW)).toBe(expected);
  });
});

describe('nextEpisodeLabel', () => {
  it('formats number and time', () => {
    expect(nextEpisodeLabel({ number: 8, airingAt: at(3 * 86400 + 10) }, NOW)).toBe('Ep. 8 · en 3 días');
  });
  it('is null when nothing is scheduled', () => expect(nextEpisodeLabel(null, NOW)).toBeNull());
});
