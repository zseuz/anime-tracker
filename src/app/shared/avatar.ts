import { AVATAR_IDS, AvatarId } from '../domain/models';

export interface AvatarStyle {
  id: AvatarId;
  label: string;
  /** CSS background for the avatar circle. */
  gradient: string;
}

const g = (a: string, b: string) => `linear-gradient(135deg, ${a}, ${b})`;

/** Presentation of each avatar colour; ids come from the domain, so they match what the server accepts. */
export const AVATAR_STYLES: readonly AvatarStyle[] = [
  { id: 'violet', label: 'Violeta', gradient: g('#7c4dff', '#ff4081') },
  { id: 'rose', label: 'Rosa', gradient: g('#ff4081', '#ff9100') },
  { id: 'blue', label: 'Azul', gradient: g('#2979ff', '#00b8d4') },
  { id: 'green', label: 'Verde', gradient: g('#00c853', '#00b8d4') },
  { id: 'orange', label: 'Naranja', gradient: g('#ff9100', '#ff3d00') },
  { id: 'teal', label: 'Turquesa', gradient: g('#00bfa5', '#304ffe') },
];

export const avatarGradient = (id: AvatarId): string =>
  (AVATAR_STYLES.find(s => s.id === id) ?? AVATAR_STYLES[0]).gradient;

// Guards against a style being added without a matching domain id (and vice versa).
if (AVATAR_STYLES.length !== AVATAR_IDS.length) throw new Error('AVATAR_STYLES out of sync with AVATAR_IDS');
