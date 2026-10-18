import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { AssetBuildContext } from './AssetBuildContext';
import { accessoryParts } from './IkeaAccessoryBuilder';

export function buildDailyLife(c: AssetBuildContext): void {
  const kind = c.definition?.dailyLife?.kind; if (!kind) return;
  const p = accessoryParts(c), m = c.materials;
  const color = (hex: string, base = m.whitePaint) => c.coloredMaterial?.(hex, base) ?? base;
  const cream = color('#d9c9ac', m.fabricLight), sisal = color('#b89b6c', m.fabricLight), dark = color('#333b43'), steel = color('#c2ccd0', m.metalChrome);
  steel.metalness = .65; steel.roughness = .32;
  const rounded = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, section: string) => p.add(new RoundedBoxGeometry(w, h, d, 2, Math.min(.035, h / 4, w / 4, d / 4)), mat, section, x, y, z);
  const dish = (x: number, y: number, z: number, r: number, h: number, mat: THREE.Material, section: string) => p.lathe([[0, 0], [r * .77, 0], [r, h], [r * .88, h], [r * .67, h * .2], [0, h * .2]], mat, section, x, y, z);
  const house = (bottom: number, height: number, width = .86) => {
    p.box(0, bottom + .015, 0, width, .03, .86, cream, 'House Floor');
    p.box(0, bottom + height - .015, 0, width, .03, .86, cream, 'House Roof');
    for (const x of [-1, 1]) p.box(x * (width / 2 - .015), bottom + height / 2, 0, .03, height, .86, cream, 'House Sides');
    p.box(0, bottom + height / 2, -.415, width, height, .03, cream, 'House Back');
    for (const x of [-1, 1]) p.box(x * width * .34, bottom + height / 2, .415, width * .32, height, .03, cream, 'Entry Surround');
    p.box(0, bottom + height * .90, .415, width * .36, height * .20, .03, cream, 'Entry Surround');
    rounded(0, bottom + .035, .02, width * .86, .025, .72, m.fabricDark, 'Cushion');
  };
  if (kind === 'cat_tree' || kind === 'cat_house') {
    const elevated = kind === 'cat_house';
    rounded(0, .02, 0, .98, .04, .98, cream, 'Base');
    const top = elevated ? .67 : .48;
    for (const x of [-.32, .32]) for (const z of [-.30, .30]) {
      p.cylinder(x, (.04 + top) / 2, z, .06, top - .04, sisal, 'Scratching Posts');
      for (let i = 0; i < 10; i++) p.ring(.061, .004, sisal, 'Sisal Wrap', x, .06 + i * (top - .08) / 10, z);
    }
    house(elevated ? .67 : .25, elevated ? .33 : .27);
    rounded(.27, elevated ? .40 : .65, .02, .43, .025, .60, cream, 'Step Platform');
    if (!elevated) {
      p.cylinder(-.19, .74, -.16, .07, .46, sisal, 'Upper Post');
      rounded(-.19, .975, -.08, .58, .05, .65, cream, 'Top Perch');
      rounded(-.19, .99, -.08, .47, .02, .53, m.fabricLight, 'Perch Cushion');
    }
  } else if (kind === 'cat_tray') {
    rounded(0, .08, 0, 1, .16, 1, dark, 'Tray');
    for (const x of [-.235, .235]) dish(x, .16, 0, .215, .84, steel, 'Bowls');
    p.cylinder(.235, .52, 0, .15, .02, color('#8db9c6'), 'Drinking Water');
    for (let i = 0; i < 18; i++) { const angle = i * 2.399963, radius = .13 * Math.sqrt((i + .5) / 18); p.cylinder(-.235 + Math.cos(angle) * radius, .50, Math.sin(angle) * radius, .018, .06, m.woodDark, 'Dry Food'); }
  } else if (kind === 'cat_litter') {
    rounded(0, .12, 0, 1, .24, .98, color('#a5b3b0'), 'Litter Tray');
    rounded(0, .25, 0, .91, .05, .89, sisal, 'Litter');
    for (const x of [-.47, .47]) rounded(x, .57, 0, .06, .76, .94, cream, 'Hood Sides');
    rounded(0, .63, -.445, .94, .62, .06, cream, 'Hood Back');
    rounded(0, .945, 0, .94, .11, .94, cream, 'Hood Roof');
    for (const x of [-.355, .355]) rounded(x, .53, .44, .23, .60, .06, cream, 'Doorway');
    rounded(0, .84, .44, .50, .12, .06, cream, 'Doorway');
    p.box(0, .99, 0, .25, .02, .08, dark, 'Carry Handle');
  } else if (kind === 'cat_fountain') {
    rounded(0, .15, 0, .95, .30, .95, steel, 'Steel Reservoir');
    dish(0, .30, 0, .45, .20, steel, 'Drinking Tray');
    p.cylinder(0, .36, 0, .365, .025, color('#96bdc5', m.glassBlack), 'Water');
    p.cylinder(0, .69, -.20, .065, .60, steel, 'Spout');
    p.box(0, .96, -.10, .13, .07, .25, steel, 'Spout');
    p.cylinder(0, .67, .005, .018, .49, color('#b4d8df'), 'Water Stream');
  } else if (kind === 'cat_feeder') {
    rounded(0, .40, -.16, .88, .78, .65, cream, 'Hopper');
    rounded(0, .95, -.16, .92, .10, .68, dark, 'Lid');
    rounded(0, .09, .05, .98, .18, .90, cream, 'Base');
    dish(0, .08, .23, .26, .13, steel, 'Food Bowl');
    p.box(0, .28, .18, .40, .16, .12, dark, 'Dispensing Chute');
    p.box(0, .57, .168, .40, .10, .018, m.screen, 'Display');
    for (const x of [-.20, 0, .20]) p.cylinder(x, .42, .18, .025, .012, steel, 'Controls').rotation.x = Math.PI / 2;
  } else if (kind === 'vanity_bottles') {
    rounded(0, .025, 0, 1, .05, 1, cream, 'Tray');
    const bottles = [[-.32, -.12, .70, .12], [0, -.20, .92, .10], [.30, -.12, .80, .11]];
    bottles.forEach(([x, z, h, r], i) => {
      p.cylinder(x, .05 + h * .40, z, r, h * .80, color(['#d4ad87', '#9cb7b3', '#d8d5cf'][i], m.glassBlack), `Bottle ${i + 1}`);
      p.cylinder(x, .05 + h * .88, z, r * .62, h * .16, steel, `Cap ${i + 1}`);
      p.box(x, .05 + h * .40, z + r, r * 1.2, h * .25, .008, m.whitePaint, 'Labels');
    });
    p.cylinder(.15, .16, .27, .15, .22, cream, 'Cream Jar'); p.cylinder(.15, .29, .27, .16, .05, steel, 'Jar Lid');
  } else if (kind === 'hot_air_brush') {
    rounded(-.24, .48, 0, .49, .55, .63, dark, 'Handle');
    rounded(.21, .50, 0, .48, .78, .82, color('#b38d99'), 'Brush Barrel');
    for (let row = 0; row < 6; row++) for (let i = 0; i < 8; i++) {
      const angle = row * Math.PI / 3;
      p.box(.02 + i * .052, .50 + Math.cos(angle) * .43, Math.sin(angle) * .45, .014, .065, .035, dark, 'Bristles');
    }
    p.box(-.22, .80, 0, .10, .04, .14, steel, 'Power Switch');
    p.box(-.475, .45, 0, .05, .12, .12, dark, 'Cord Stub');
  } else if (kind === 'jewelry_tray') {
    rounded(0, .14, 0, 1, .28, 1, cream, 'Dish Base');
    for (const x of [-.47, .47]) rounded(x, .35, 0, .06, .45, .94, cream, 'Dish Rim');
    for (const z of [-.47, .47]) rounded(0, .35, z, .94, .45, .06, cream, 'Dish Rim');
    p.ring(.09, .018, m.metalBrass, 'Ring', -.20, .38, .02); p.ring(.22, .014, steel, 'Bracelet', .17, .36, -.10);
    p.box(-.05, .39, .24, .36, .04, .06, steel, 'Key'); p.ring(.055, .014, steel, 'Key', -.25, .39, .24);
  } else if (kind === 'nespresso') {
    rounded(0, .43, -.045, .82, .80, .65, dark, 'Housing');
    const tank = color('#9bbac7', m.glassBlack); tank.transparent = true; tank.opacity = .4;
    rounded(0, .46, -.36, .72, .86, .27, tank, 'Water Reservoir');
    rounded(0, .91, -.36, .76, .04, .28, dark, 'Reservoir Lid');
    rounded(0, .53, .30, .66, .54, .12, dark, 'Capsule Head');
    p.cylinder(0, .39, .34, .045, .12, steel, 'Coffee Outlet');
    rounded(0, .035, .29, .94, .07, .42, dark, 'Drip Tray');
    for (let i = 0; i < 7; i++) p.box(-.36 + i * .12, .076, .29, .025, .012, .32, steel, 'Drip Tray Grille');
    for (const x of [-.18, .18]) p.cylinder(x, .845, .05, .07, .025, color('#b6c9ad'), 'Brew Buttons');
    for (const x of [-.30, .30]) p.rod(new THREE.Vector3(x, .85, -.18), new THREE.Vector3(x, .98, .12), .018, steel, 'Capsule Lever');
    p.rod(new THREE.Vector3(-.30, .98, .12), new THREE.Vector3(.30, .98, .12), .018, steel, 'Capsule Lever');
    for (const side of [-1, 1]) for (let rib = 0; rib < 8; rib++) p.box(side * .414, .42, -.28 + rib * .065, .012, .61, .018, m.metalBlack, 'Side Ribs');
  } else if (kind === 'dishwasher') {
    rounded(0, .51, 0, .98, .98, .98, color('#c9cdd0', steel), 'Body');
    p.box(0, .47, .492, .94, .82, .016, color('#d9dcdd', steel), 'Door');
    p.box(0, .92, .492, .94, .10, .016, dark, 'Control Panel');
    p.box(0, .82, .495, .55, .025, .01, dark, 'Handle Recess');
    p.box(0, .045, .47, .90, .075, .02, dark, 'Plinth');
    p.box(.23, .92, .495, .18, .045, .009, m.screen, 'Display');
    for (let i = 0; i < 4; i++) p.box(-.33 + i * .10, .92, .495, .025, .02, .009, steel, 'Buttons');
  } else if (kind.startsWith('garment_')) {
    const coat = kind === 'garment_coat', cloth = color(coat ? '#596170' : '#7f97ac', m.fabricLight);
    rounded(0, .46, 0, .70, .84, .66, cloth, 'Garment Body');
    for (const x of [-1, 1]) rounded(x * .40, .65, 0, .16, .50, .54, cloth, 'Sleeves');
    p.box(0, .45, .36, .012, .80, .02, steel, 'Zipper');
    for (const x of [-1, 1]) p.rod(new THREE.Vector3(0, .94, 0), new THREE.Vector3(x * .40, .84, 0), .008, m.woodLight, 'Hanger');
    p.ring(.045, .006, steel, 'Hanger Hook', 0, .945, 0, true);
    const cover = new THREE.MeshStandardMaterial({ color: '#e5edf0', transparent: true, opacity: .16, depthWrite: false, roughness: .8 });
    rounded(0, .46, 0, .98, .90, .98, cover, 'Garment Envelope');
  } else if (kind.startsWith('boots_') || kind.startsWith('sneakers_')) {
    const boots = kind.startsWith('boots_'), tall = kind === 'boots_women', leather = color(boots ? '#8b6951' : '#d4d8d8', boots ? m.whitePaint : m.fabricLight);
    for (const x of [-.255, .255]) {
      rounded(x, .045, 0, .47, .09, .98, dark, 'Soles');
      rounded(x, boots ? .17 : .31, .08, .43, boots ? .26 : .44, .80, leather, 'Uppers');
      rounded(x, tall ? .56 : boots ? .49 : .48, -.22, .34, tall ? .87 : boots ? .72 : .78, .40, leather, 'Shafts');
      if (!tall) for (let i = 0; i < 5; i++) p.box(x, boots ? .30 + i * .035 : .55 + i * .025, .12 - i * .075, .25, .016, .018, m.fabricLight, 'Laces');
      else p.box(x + .17, .59, -.22, .009, .68, .018, steel, 'Side Zippers');
    }
  } else if (kind === 'drawer_organizer') {
    const wall = .003, cellW = .085, cellD = .22, cols = Math.max(0, Math.min(12, Math.floor((c.w - wall * 2) / cellW))), rows = Math.max(0, Math.min(8, Math.floor((c.d - wall * 2) / cellD)));
    p.box(0, .03, 0, 1, .06, 1, cream, 'Organizer Base');
    const metricBox = (x: number, z: number, w: number, d: number) => p.box(-.5 + x / c.w, .53, -.5 + z / c.d, w / c.w, .94, d / c.d, cream, 'Compartment Walls');
    for (let col = 0; col <= cols; col++) if (rows) metricBox(wall + col * cellW, wall + rows * cellD / 2, wall, rows * cellD);
    for (let row = 0; row <= rows; row++) if (cols) metricBox(wall + cols * cellW / 2, wall + row * cellD, cols * cellW, wall);
    c.parent.userData.organizer = { columns: cols, rows, cellWidth: cellW, cellDepth: cellD };
  } else if (kind === 'trouser_rack') {
    for (const x of [-.46, .46]) p.box(x, .40, 0, .06, .18, .96, steel, 'Telescopic Rails');
    p.box(0, .40, .45, .94, .18, .06, dark, 'Pull Bar');
    const count = Math.max(0, Math.min(20, Math.floor((c.w - .08) / .065)));
    for (let i = 0; i < count; i++) p.box((-.5 + (.04 + (i + .5) * .065) / c.w), .45, 0, .012 / c.w, .16, .80, steel, 'Trouser Bars');
  }
}
