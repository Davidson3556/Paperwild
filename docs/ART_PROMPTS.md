# Original art assets — Paperwild

These original woodland characters and paper illustrations were generated with an AI image-generation tool for this game. No reference illustration was traced or reused. Generated 17 October 2026. The exact original prompts below retain the game's working title.

## Character atlas

- Source: `public/art/marginwood-sprites.png`.
- Dimensions: 1086 × 1448 pixels, with genuine PNG alpha transparency.
- Layout: three columns by four rows, each cell exactly 362 × 362 pixels.
- Cell order: Amber pawn, rook, knight; Amber bishop, queen, king; Indigo pawn, rook, knight; Indigo bishop, queen, king.
- Individual transparent cells are preserved in `public/art/pieces/` as `wp.png`, `wr.png`, `wn.png`, `wb.png`, `wq.png`, `wk.png`, `bp.png`, `br.png`, `bn.png`, `bb.png`, `bq.png`, `bk.png`.
- The final spacing-edited generated image is preserved unchanged as `public/art/marginwood-sprites-source.png`.
- Native macOS Swift/ImageIO crops follow the transparent gutters and isolate each whole character. Each character is then proportionally resized and placed on a transparent 362 × 362 cell with a minimum 12% margin and common baseline. The final atlas is assembled from these same cells. No painting, recoloring, or synthetic illustration was added during this export step.

### Exact character prompt

```text
Use case: illustration-story.
Asset type: production sprite atlas for an original storybook chess game called The Marginwood Club.

Create ONE clean character contact sheet with actual transparent alpha background. The canvas has exactly THREE columns and FOUR rows of equal SQUARE cells (overall aspect ratio 3:4). There are exactly TWELVE separate full-body woodland characters, one per cell, centered in the cell. Each complete character must fit inside its own cell with a generous 12% transparent margin on every side, including ears, crowns, wings and tails. Keep every cell the same scale and the feet/bases at the same baseline. No overlap between cells. No cast ground shadows extending beyond characters. No borders, no gridlines, no labels, no letters, no text, no watermark. The transparent background is essential: show only the twelve character cutouts.

Art direction: original, expressive, tender hand-drawn colored-pencil and warm graphite illustrations, with light transparent watercolor washes inside the silhouettes. Visible irregular fine pencil strokes, lively sketch hatching, subtly furry or woody texture, believable animal anatomy, charming thoughtful eyes and hand-drawn asymmetry. The visual feeling is a beautifully observed woodland field notebook come to life. Draw like a highly skilled children's-book illustrator using real pencil on textured paper, but retain genuine transparency around each character; no paper rectangles or painted backgrounds. Crisp readable silhouette at small game-piece sizes. Three-quarter full-body views, all facing slightly toward the viewer. Not vector, not flat iconography, not polished digital sticker art, not plastic, not 3D, not neon, not glossy. Avoid oversized kawaii heads and avoid photographic rendering.

The first two rows form the AMBER chess side: pale warm cream, muted acorn-gold, russet, warm graphite, subtle earthy amber accessories.
The last two rows form the INDIGO chess side: muted ink blue, slate indigo, cool gray cream, warm graphite, subtle indigo accessories. Keep the species and role silhouettes consistent between sides, but give the indigo characters slightly different natural gestures and expressions. The amber and indigo accessories should make the side colors readable without making the animals unnatural.

EXACT cell contents, read left to right, top to bottom:
Row 1, column 1: AMBER PAWN — a little acorn-cap woodland sprite, with an acorn cupule cap, small natural body, slender arms and legs, a shy curious expression and tiny leaf collar. A simple compact silhouette.
Row 1, column 2: AMBER ROOK — a smiling hollow tree stump character, with expressive face in its warm wood grain, mossy crown shaped like soft natural battlements, roots as feet and two twig arms.
Row 1, column 3: AMBER KNIGHT — a long-eared hare in a poised little leap, anatomically recognizable rabbit hind legs, delicate paws, a tiny traveler bag, warm cream and soft russet fur. Both ears complete, travel bag visible.
Row 2, column 1: AMBER BISHOP — a gentle moth character standing with softly patterned folded/open wings and a tall pointed leaf hat. The leaf hat supplies the bishop-like high silhouette, not a human mitre.
Row 2, column 2: AMBER QUEEN — an elegant seated fox with delicate wildflower crown, full curled tail, warm russet and cream fur, attentive kind eyes and slim graceful silhouette.
Row 2, column 3: AMBER KING — a bookish badger sitting upright with a tiny simple crown and fine round spectacles, holding a small closed book. Recognizable badger facial markings, cream and graphite fur, amber book cover.

Row 3, column 1: INDIGO PAWN — the same little acorn-cap woodland sprite archetype, but with a cool slate-blue acorn cap and indigo leaf collar, a slightly braver expression.
Row 3, column 2: INDIGO ROOK — the same smiling hollow tree stump archetype, cool brown-gray wood grain, deep blue-green mossy battlements, roots as feet and twig arms.
Row 3, column 3: INDIGO KNIGHT — the same long-eared hare archetype in a different small poised leap, cool cream-gray fur and tiny indigo traveler bag.
Row 4, column 1: INDIGO BISHOP — the same gentle moth archetype with softly patterned slate and indigo wings, and a tall pointed indigo leaf hat.
Row 4, column 2: INDIGO QUEEN — the same elegant fox archetype, subdued smoky russet/cream fur and delicate cornflower-blue wildflower crown, full curled tail.
Row 4, column 3: INDIGO KING — the same bookish badger archetype, tiny crown, fine round spectacles, cream and graphite markings, holding a small indigo book.

Critical: exactly twelve characters in the exact specified 3-by-4 order, no extra objects or characters, every whole character fully visible, generous consistent transparent margins, all cells equal squares, actual alpha transparency, absolutely no background or text.
```

### Exact targeted spacing correction prompt

```text
Edit target: the supplied original transparent woodland character atlas.
Make ONE precise technical correction only: fix the spacing so every entire character is fully isolated within its own equal square cell. Preserve the same twelve characters, their designs, expressions, colored-pencil/graphite illustration style, amber and indigo palettes, and their exact order. Do not redesign them or add anything.
The atlas must remain exactly THREE columns by FOUR rows of equal square cells. Current characters are too large and some ears/wings slightly cross cell boundaries. Scale down each whole character uniformly inside its original cell until it has at least 12% empty TRANSPARENT margin on every side. Treat each character plus crown, ears, wings, tails and feet as one whole subject. Center it in its own cell and align the bases consistently. Move stray neighboring fragments back into their own original cell. Do not cut off any ears, wings, crowns, roots or tails. Every whole silhouette must be fully visible and separate with generous empty gutters.
Exact unchanged row order:
Row1: amber acorn-cap pawn sprite; amber smiling hollowtree stump rook; amber long-eared hare knight with travelerbag.
Row2: amber pointed-leafhat moth bishop; amber flowercrowned fox queen; amber crowned bespectacled bookish badger king.
Row3: indigo acorn-cap pawn sprite; indigo smiling hollowtree stump rook; indigo long-eared hare knight with travelerbag.
Row4: indigo pointed-leafhat moth bishop; indigo flowercrowned fox queen; indigo crowned bespectacled bookish badger king.
Real transparent alpha background, no paper/background/grid/lines/labels/text. Same beautiful hand-drawn colored-pencil and warm graphite linework and light watercolor washes; only spacing and scale inside each original cell should change.
```

## Sketchbook paper

- Source: `public/art/sketchbook-paper.png`.
- Dimensions: 1536 × 1024 pixels, opaque PNG.
- The generated paper scan texture is retained unchanged.
- Runtime export: `public/art/sketchbook-paper.jpg`, encoded from that PNG with native macOS `sips` at JPEG quality 86. The lighter file is used by the page; the original PNG remains available for provenance.

### Exact paper prompt

```text
Use case: photorealistic-natural.
Asset type: full-page texture background for a hand-drawn woodland sketchbook website.
Create an actual photographic high-resolution flatbed scan of a single large sheet of aged heavy ivory drawing paper, landscape aspect ratio 3:2, seen perfectly straight-on and filling the whole frame edge-to-edge. Texture only. Warm pale cream background with very subtle natural paper fibers, tiny graphite and colored-pencil dust specks dispersed sparingly, gentle softly irregular paper grain, and understated deckle-edge/fold impressions only very near the outer edges. The central 85% must remain VERY LIGHT, clean and quiet, so dark pencil writing and character art remain readable when laid over it. Fine tactile tooth like good artist's drawing paper. Natural neutral diffuse scanner light, no directionally cast shadows or dramatic lighting. The paper should feel real, matte, handmade and touchable, without a fake grunge filter.
Absolutely no drawings, illustrations, handwriting, letters, numbers, lines, grids, borders, watermarks, objects, pencils, brushes, leaves, stains, dark spots, vignettes or separate rectangular sheets. No text. No background beyond the paper. Keep the entire image softly light ivory with subtle organic texture, no dark edge framing. This is a texture asset, not a staged photograph. Opaque background.
```
