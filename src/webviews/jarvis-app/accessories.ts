/**
 * Cosmetic accessories worn by the Genouk mascot. Rendered as an emoji overlay
 * positioned over the sprite (no art assets needed). `top` is a percentage down
 * the sprite where the accessory sits; `size` is the glyph size in px.
 */
export interface Accessory {
  id: string;
  label: string;
  emoji: string;
  top: string;
  size: number;
}

export const ACCESSORIES: Accessory[] = [
  { id: 'none', label: 'None', emoji: '', top: '0%', size: 0 },
  { id: 'tophat', label: 'Top hat', emoji: '🎩', top: '-2%', size: 56 },
  { id: 'crown', label: 'Crown', emoji: '👑', top: '0%', size: 50 },
  { id: 'cap', label: 'Cap', emoji: '🧢', top: '0%', size: 54 },
  { id: 'grad', label: 'Grad cap', emoji: '🎓', top: '0%', size: 54 },
  { id: 'party', label: 'Party hat', emoji: '🥳', top: '-4%', size: 52 },
  { id: 'headphones', label: 'Headphones', emoji: '🎧', top: '14%', size: 58 },
  { id: 'glasses', label: 'Sunglasses', emoji: '🕶️', top: '26%', size: 46 },
  { id: 'bowtie', label: 'Bow tie', emoji: '🎀', top: '62%', size: 40 },
  { id: 'star', label: 'Sparkle', emoji: '✨', top: '6%', size: 44 },
];

export const DEFAULT_ACCESSORY = 'none';

export function findAccessory(id: string): Accessory {
  return ACCESSORIES.find((a) => a.id === id) ?? ACCESSORIES[0];
}
