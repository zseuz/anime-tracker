import { AVATAR_IDS } from '../domain/models';
import { AVATAR_STYLES, avatarGradient } from './avatar';

describe('avatar styles', () => {
  it('has one style for every domain id, in the same order', () => {
    expect(AVATAR_STYLES.map(s => s.id)).toEqual([...AVATAR_IDS]);
  });

  it('gives every colour a distinct gradient and a label', () => {
    expect(new Set(AVATAR_STYLES.map(s => s.gradient)).size).toBe(AVATAR_STYLES.length);
    expect(AVATAR_STYLES.every(s => s.label.length > 0 && s.gradient.startsWith('linear-gradient'))).toBe(true);
  });

  it('avatarGradient resolves an id, falling back to the first style', () => {
    expect(avatarGradient('teal')).toBe(AVATAR_STYLES[5].gradient);
    expect(avatarGradient('nope' as never)).toBe(AVATAR_STYLES[0].gradient);
  });
});
