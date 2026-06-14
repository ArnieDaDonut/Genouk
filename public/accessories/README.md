# Mascot cosmetic cut-outs

Drop the cut-out cosmetics here as **transparent-background PNGs**, one file per
accessory, using the exact filenames below. They come from the cosmetics sprite
sheet (`public/Gemini_Generated_Image_9275e79275e79275.png`).

| File              | Item        |
| ----------------- | ----------- |
| `tophat.png`      | Top hat     |
| `crown.png`       | Crown       |
| `cap.png`         | Cap (the "G" cap) |
| `grad.png`        | Graduation cap |
| `party.png`       | Party hat   |
| `headphones.png`  | Headphones  |
| `glasses.png`     | Sunglasses  |
| `bowtie.png`      | Bow tie     |
| `star.png`        | Sparkle     |
| `none.png`        | "None" icon (shown in the picker only) |

Notes:
- **Transparency is required** — these overlay the character, so any background
  pixels will show as a box around the item.
- Trim each PNG tight to the artwork (no large empty margins); the placement
  math in `src/webviews/genouk-app/accessories.ts` assumes the visible art fills
  the file.
- Until a file exists, that accessory automatically renders its emoji fallback,
  so the app keeps working with whatever subset you've added.
- Per-item position/size is tuned in `accessories.ts` (`top`, `left`, `width`,
  `rotate`). After dropping in the real art, nudge those values if an item sits
  slightly high/low on the mascot.
