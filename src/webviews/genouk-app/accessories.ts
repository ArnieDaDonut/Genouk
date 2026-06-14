/**
 * Cosmetic accessories worn by the Genouk mascot.
 *
 * Each accessory can render two ways, in priority order:
 *   1. A cut-out PNG in `public/accessories/<img>` (transparent background) —
 *      the real artwork, loaded via `window.ACCESSORY_BASE`.
 *   2. The `emoji` glyph — a zero-asset fallback used until the PNG is supplied
 *      (or if it fails to load).
 *
 * Placement is relative to the square mascot sprite frame. In the resting sheet
 * the robot's head sits ~21% down from the top of the frame and is centred a
 * touch left of middle (~48%), so head-worn items anchor around there. `top` is
 * the item's top edge as a % of frame height; `left` is its horizontal centre.
 */
export interface Accessory {
  id: string;
  label: string;
  /** Cut-out PNG filename in public/accessories/ (transparent background). */
  img?: string;
  /** Fallback glyph used until the PNG exists / if it fails to load. */
  emoji: string;
  /** Top edge of the item, as a % of the sprite frame height. */
  top: string;
  /** Horizontal centre of the item, as a % of frame width. Defaults to 48%. */
  left?: string;
  /** Rendered width in px for the image variant (height keeps aspect ratio). */
  width: number;
  /** Glyph size in px for the emoji fallback. */
  size: number;
  /** Optional tilt, in degrees. */
  rotate?: number;
}

// Placement is tuned against the resting sprite: the robot's head sits ~24% down
// and is centred ~50% across. `top`/`left`/`width` were dialled in by compositing
// each cut-out onto the actual frame, so they sit on the head/face/neck normally.
export const ACCESSORIES: Accessory[] = [
  { id: 'none', label: 'None', img: 'none.png', emoji: '', top: '0%', width: 0, size: 0 },
  // Head-worn: brim/base rests on the head.
  { id: 'tophat', label: 'Top hat', img: 'tophat.png', emoji: '🎩', top: '15%', width: 60, size: 58 },
  { id: 'crown', label: 'Crown', img: 'crown.png', emoji: '👑', top: '13%', width: 64, size: 52 },
  { id: 'cap', label: 'Cap', img: 'cap.png', emoji: '🧢', top: '13%', width: 64, size: 56 },
  { id: 'grad', label: 'Grad cap', img: 'grad.png', emoji: '🎓', top: '11%', left: '49%', width: 72, size: 56 },
  { id: 'party', label: 'Party hat', img: 'party.png', emoji: '🥳', top: '5%', width: 44, size: 54 },
  // Cups over the ears / band over the head.
  { id: 'headphones', label: 'Headphones', img: 'headphones.png', emoji: '🎧', top: '19%', width: 68, size: 62 },
  // Face: across the eyes.
  { id: 'glasses', label: 'Sunglasses', img: 'glasses.png', emoji: '🕶️', top: '29%', left: '51%', width: 56, size: 40 },
  // Neck / upper chest.
  { id: 'bowtie', label: 'Bow tie', img: 'bowtie.png', emoji: '🎀', top: '42%', width: 40, size: 34 },
  // Decorative sparkle around the head.
  { id: 'star', label: 'Sparkle', img: 'star.png', emoji: '✨', top: '9%', width: 86, size: 46 },
];

export const DEFAULT_ACCESSORY = 'none';

export function findAccessory(id: string): Accessory {
  return ACCESSORIES.find((a) => a.id === id) ?? ACCESSORIES[0];
}

/** Full URL to an accessory's cut-out PNG, or '' if it has none / base unset. */
export function accessoryImageUrl(a: Accessory): string {
  const base: string = (typeof window !== 'undefined' && (window as any).ACCESSORY_BASE) || '';
  return a.img && base ? `${base}/${a.img}` : '';
}
