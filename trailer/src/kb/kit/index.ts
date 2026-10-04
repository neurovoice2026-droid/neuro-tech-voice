/**
 * FILM 2's SHARED KIT — the parts every act is built from (CLIENT DIRECTION v2: the site's gradient
 * meshes as grounds, the real app tabs, a real cursor). Import from here:
 *
 *   import { MeshGround, TabBar, useTabBar, Cursor, click, hoverAt, pressAt, Panel, … } from '../kit';
 *
 * RULES THE PARTS SHARE
 *   · TIME. Every part takes `t` in 30 fps TIMELINE frames (fractional at the 120 fps render): pass the
 *     act's local or the film's absolute time — the parts never read a clock of their own. All motion
 *     is a pure function of t (springs in closed form): 120 fps is sampled 4× finer, never stepped.
 *   · SPACE. Parts are absolutely positioned in their PARENT's px (1920×1080 / 1080×1920 frames). The
 *     cursor's keys, hoverAt/pressAt rects and the parts they drive must live in the same space: put
 *     them in one container (and move that container, not the parts, for a camera move).
 *   · TYPE. The house system only (src/theme.ts TYPE, Instrument Sans; Geist Mono for tokens); UI
 *     chrome in sentence case via kit/type.ts ui(). Geometry hooks (useTabBar, useMenu, useFieldCard,
 *     useDocPage) measure with canvas once the faces are in (they hold the frame until then).
 *   · SHARPNESS. Text reveals rise out of masks (never blur); anything carrying text moves by
 *     transform on a sub-pixel glide layer (lib/glide); geometric marks that move (the tab underline,
 *     hairlines) are SVG, anti-aliased at their exact fractional edges. Canvases are DPR-sized.
 *
 * THE PARTS (file → exports)
 *   palettes.ts (../palettes)  MUTED_MESH, KB_MESH = HOME_KB_MESH, INK_MESH, MOMENT_LIGHTS, PLAN_LIGHTS,
 *                              STUDIO_PANEL, DEEP_PANEL, PRICING_PANEL, HOME — verbatim from the site
 *   mesh.ts / MeshGround.tsx   <MeshGround t palette paletteB? mix? variant|lift keyLight? brightness?
 *                              saturation? speed? drift? turn? seed? shade? grain? dither? quality? recipe?>
 *                              meshAt(), gradePalette(), meshShadowInk(palette) (a card's shadow ink)
 *   cursor.ts / Cursor.tsx     <Cursor keys t size?>; keys = {at, x, y, action?, kind?, bend?, dur?}[];
 *                              click(at, x, y, {dwell, hold, kind}), cursorAt, cursorPos, hoverAt(keys,t,rect),
 *                              pressAt(keys,t,rect), clickedAt, clicksOf(keys) → {down, up, x, y}[], CURSOR
 *   TabBar.tsx                 useTabBar({x, y, width?, size?, icons?, badge?, dirty?}) → bar (rect(tab, t));
 *                              <TabBar bar t active cursor? strip? radius? ink?>, TABS
 *   ui.tsx                     APP tokens, meshElevation(lift, ink, k), <Panel>, <Button> + buttonSize,
 *                              <Pill states>, <DocRow> + docRowHeight / docRowMenuRect / rowPillSize,
 *                              useMenu + <Menu> + DOC_MENU, useFieldCard + <FieldCard> + typingTimes,
 *                              <RecordRow>, <Swap>, <CheckMark>
 *   paper.tsx                  useDocPage + <DocPage sweep dim edit hide fade>, <InkSweep>, <SlipStack>,
 *                              <FlipWord>, <MeaningLink>, <WordReset>, labelWidth
 *   icons.tsx                  <Icon name size stroke? rotate?> — lucide's own node data (ICONS)
 *   type.ts                    ui(size, weight), measureText, spaceWidth, layoutWords, wrapWords, useKitFaces, W
 *   typed.ts                   typedOpacity, typedCount — typed text in place (a one-frame appearance, no travel) and
 *                              the caret after the last half-visible glyph group (product fields; never a masked rise)
 *
 * SPECIMEN: compositions KB-Kit-16x9 / KB-Kit-9x16 (30 fps), KB-Kit120-16x9 (120 fps) and the ground
 * probe KB-KitMesh-16x9 / -9x16 (input props: palette, lift, recipe, keyOn, grain, dither, quality),
 * all in src/kb/Root.tsx's KB-Scenes folder (kit/Specimen.tsx, kit/MeshProbe.tsx).
 */
export * from './mesh';
export * from './MeshGround';
export * from './recipe';
export * from './cursor';
export * from './Cursor';
export * from './TabBar';
export * from './ui';
export * from './paper';
export * from './icons';
export * from './type';
export * from './typed';
