# Paperwild watercolor cast

Created on 17 October 2026 for the child-painted, living chessbook direction. All twelve characters use a new watercolor cartoon treatment, loose pencil contours, open expressive eyes, and simple silhouettes. Animal colors stay warm and earthy; amber and indigo scarves identify the two clubs.

## Files and delivery

- Original generated PNGs: `public/art/watercolor/{w,b}{p,r,n,b,q,k}.png`.
- Web delivery copies: `public/art/watercolor/web/{w,b}{p,r,n,b,q,k}.png`.
- Every original is 1254 × 1254 pixels, 8-bit RGBA. Generated transparency is retained.
- The web copies are deterministic 480 × 480 resizes of the selected originals. They preserve alpha and reduce the total cast from about 22 MB to about 3.4 MB. The runtime selects the web copies through `characterArt()`.
- Existing `public/art/pieces` paintings are preserved.

All twelve selected PNGs were inspected visually. A byte-level PNG check confirmed 8-bit RGBA data, real zero-alpha pixels, and an alpha range of 0–255 in every image. The painted silhouette bounds below use alpha greater than 32; coordinates are original-canvas pixels, with the right and bottom edges exclusive.

| Sprite | Painted bounds (left, top, right, bottom) |
| --- | --- |
| `wp` | 131, 74, 1166, 1195 |
| `bp` | 163, 81, 1140, 1174 |
| `wr` | 91, 63, 1174, 1176 |
| `br` | 105, 96, 1184, 1172 |
| `wn` | 226, 41, 973, 1185 |
| `bn` | 223, 22, 1043, 1230 |
| `wb` | 25, 100, 1226, 1158 |
| `bb` | 41, 178, 1213, 1105 |
| `wq` | 134, 47, 1234, 1196 |
| `bq` | 34, 40, 1235, 1186 |
| `wk` | 230, 67, 1013, 1210 |
| `bk` | 254, 15, 1060, 1223 |

## Generation method

All artwork was generated with the built-in `image_gen.imagegen` tool in transparent-background mode. No fallback CLI or external API key was used. Each character was a separate generation using the common prompt below followed by its exact subject line.

Common prompt:

```text
Use case: illustration-story.
Asset type: transparent game character sprite for Paperwild, a child's living watercolor chessbook.
Style/medium: a charming naive children's watercolor painting with loose wobbly graphite pencil contours, translucent pigment blooms, uneven hand-painted edges, big simple cartoon shapes, expressive glossy dark oval eyes with small white highlights, soft blush, small smiling mouth. Flat 2D hand-drawn storybook, adorable toon, visible watery pigment texture within the subject, no photorealism, no 3D, no glossy plastic, no realistic fur, no professional vector finish.
Composition: ONE full-body character centered in square canvas, generous transparent padding at least 10% on every edge. Feet/base at 86% canvas height, top at 12%, character fills around 72% height. Front facing, slight 3/4 turn acceptable, both eyes clearly visible and wide open, warm alive curious expression. Separate tiny arms/paws at sides and visible simple legs/feet if appropriate, useful for animation. Eyes unobscured. Keep strong readable silhouette at 60 pixels.
Backdrop: genuinely transparent alpha background outside watercolor character. No paper rectangle, no scene, no ground shadow, no surrounding decoration, no grid, no checkerboard.
Constraints: no text, no numbers, no watermark, no extra character. Not a sprite sheet.
```

Exact subject lines:

### `wp.png`

```text
Subject: A tiny round cheerful acorn sprite with pale honey acorn body, russet wavy acorn cap, two small green leaf sprigs, a tiny amber scarf, little twig arms with mitten hands and stubby feet. Huge friendly black eyes on upper-middle acorn body.
```

### `bp.png`

```text
Subject: A tiny round cheerful acorn sprite with pale honey acorn body, russet wavy acorn cap, two small green leaf sprigs, a tiny indigo-blue scarf, little twig arms with mitten hands and stubby feet. Huge friendly black eyes on upper-middle acorn body.
```

### `wn.png`

```text
Subject: An adorable plump golden-tan baby hare with cream tummy and muzzle, two long upright floppy ears with pink interiors, tiny front paws held near chest, large rounded hind feet, little white cotton tail. Tiny amber scarf. Simple playful upright seated bunny pose, clear ears for animation.
```

### `bn.png`

```text
Subject: An adorable plump golden-tan baby hare with cream tummy and muzzle, two long upright floppy ears with pink interiors, tiny front paws held near chest, large rounded hind feet, little white cotton tail. Tiny indigo-blue scarf. Simple playful upright seated bunny pose, clear ears for animation.
```

### `wr.png`

```text
Subject: A cheerful living woodland tree stump, rounded short chestnut trunk with simple watercolor bark squiggles, pale flat cut top, friendly huge eyes on upper trunk, tiny smiling mouth, two separate branch arms with rounded twig hands, root feet. A small leaf sprout on one upper corner, tiny amber neckerchief around lower face. Toon stump, not a realistic tree.
```

### `br.png`

```text
Subject: A cheerful living woodland tree stump, rounded short chestnut trunk with simple watercolor bark squiggles, pale flat cut top, friendly huge eyes on upper trunk, tiny smiling mouth, two separate branch arms with rounded twig hands, root feet. A small leaf sprout on one upper corner, tiny indigo-blue neckerchief around lower face. Toon stump, not a realistic tree.
```

### `wb.png`

```text
Subject: A sweet little round fuzzy moth with pale cream round face and body, huge friendly eyes, two curly antennae, two big broad scalloped sage-green and warm cream wings held outward symmetrically, simple sparse spots, tiny amber scarf. Two little arms held forward and dangling tiny feet. Clearly readable left and right wing silhouette separate from body. Not butterfly realism.
```

### `bb.png`

```text
Subject: A sweet little round fuzzy moth with pale cream round face and body, huge friendly eyes, two curly antennae, two big broad scalloped sage-green and warm cream wings held outward symmetrically, simple sparse spots, tiny indigo-blue scarf. Two little arms held forward and dangling tiny feet. Clearly readable left and right wing silhouette separate from body. Not butterfly realism.
```

### `wq.png`

```text
Subject: An adorable round ginger fox queen with huge dark eyes, creamy muzzle and belly, two large pointy ears, tiny gold three-point paper crown, amber scarf, short arms and mitten paws held apart near tummy, two small feet, enormous fluffy orange tail with cream tip curving to the viewer's right. Front facing seated upright, clear tail silhouette, friendly curious grin. Not realistic fur.
```

### `bq.png`

```text
Subject: An adorable round ginger fox queen with huge dark eyes, creamy muzzle and belly, two large pointy ears, tiny gold three-point paper crown, indigo-blue scarf, short arms and mitten paws held apart near tummy, two small feet, enormous fluffy orange tail with cream tip curving to the viewer's right. Front facing seated upright, clear tail silhouette, friendly curious grin. Not realistic fur.
```

### `wk.png`

```text
Subject: An adorable round woodland badger king, charcoal-gray and cream head with two bold dark eye-stripes, warm grey plump body and cream tummy, two round ears, huge friendly black eyes clearly visible, small brass wire round spectacles framing but not hiding eyes, a tiny gold three-point paper crown, amber scarf. Two small separate arms with mitten paws, tiny flat feet. Front facing upright cuddly pose, jovial kind smile. Simple watercolor black-and-cream face patches.
```

### `bk.png`

```text
Subject: An adorable round woodland badger king, charcoal-gray and cream head with two bold dark eye-stripes, warm grey plump body and cream tummy, two round ears, huge friendly black eyes clearly visible, small brass wire round spectacles framing but not hiding eyes, a tiny gold three-point paper crown, indigo-blue scarf. Two small separate arms with mitten paws, tiny flat feet. Front facing upright cuddly pose, jovial kind smile. Simple watercolor black-and-cream face patches.
```

## Indigo moth framing revision

The initial `bb` painting touched both horizontal canvas edges. The final selected `bb.png` came from one built-in image edit of that painting, using its local path as the reference, with transparency enabled. The revision restored both complete outer wing tips. Exact edit prompt:

```text
Use case: precise-object-edit. This image is the edit target, a transparent watercolor moth chess sprite. Keep the SAME moth character, same face, same open eyes, same blue scarf, same hand-painted watercolor style and colors, same centered pose. Change only framing: zoom the entire character out by 20 percent to create at least 10 percent genuinely transparent padding around ALL four edges. Reconstruct and show both complete outer wing tips currently slightly cropped, matching the existing wing painting. Entire silhouette must fit inside the canvas. Preserve genuine transparent alpha background, no paper, no shadow, no text, no new objects.
```

## Animation fitting

Eye centers and articulated parts are fitted separately to each painting in `character-face.ts` and `character-idle.ts`. Coordinates use a normalized square canvas so the same maps work on the original and 480-pixel delivery copies. The cast exposes open eyes, acorn and stump hands, hare ears and paws, moth wings and feelers, fox paws and tail, and badger paws for motion.
