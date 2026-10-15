import * as THREE from 'three';
import type { WallEntity,WallFrameStyle } from '../../core/types/plan';
import type { WallSurfacePalette } from '../materials/WallSurfacePalette';
import type { WallOpeningCut } from './WallMeshBuilder';
type FrameDividerGenerator = (
  innerW: number,
  innerH: number,
  profileW: number,
  length: number,
  mullionW: number,
  mullionD: number,
  addBar: (w: number, h: number, d: number, cx: number, cy: number) => void
) => void;

const FRAME_DIVIDER_STRATEGIES: Partial<Record<WallFrameStyle, FrameDividerGenerator>> = {
  grid_3: (innerW, innerH, profileW, length, mullionW, mullionD, addBar) => {
    // 2 horizontal dividers (3 stacked panes)
    for (let i = 1; i <= 2; i++) {
      const cy = profileW + innerH * (i / 3);
      addBar(innerW, mullionW, mullionD, length / 2, cy);
    }
  },
  grid_4: (innerW, innerH, profileW, length, mullionW, mullionD, addBar) => {
    // 3 horizontal dividers (4 stacked panes)
    for (let i = 1; i <= 3; i++) {
      const cy = profileW + innerH * (i / 4);
      addBar(innerW, mullionW, mullionD, length / 2, cy);
    }
  },
  grid_2x3: (innerW, innerH, profileW, length, mullionW, mullionD, addBar) => {
    // 1 center vertical divider + 2 horizontal dividers (6 panes)
    addBar(mullionW, innerH, mullionD, length / 2, profileW + innerH / 2);
    for (let i = 1; i <= 2; i++) {
      const cy = profileW + innerH * (i / 3);
      addBar(innerW, mullionW, mullionD, length / 2, cy);
    }
  },
};


export class WallTrimsBuilder {
  constructor(private readonly materials: WallSurfacePalette) { }
  buildWallFrame(
    wall: WallEntity,
    length: number,
    maxHeight: number,
    thickness: number,
    angle: number
  ): THREE.Group {
    const frameGroup = new THREE.Group();
    frameGroup.name = `frame_${wall.id}`;
    frameGroup.userData = { type: 'wall_frame', id: wall.id, wall };
    frameGroup.position.set(wall.p1.x, 0, wall.p1.y);
    frameGroup.rotation.y = -angle;

    const frameMat = this.materials.getFrameMaterial(wall.frameColor);
    const extStart = wall.startOffset || 0;
    const extEnd = wall.endOffset || 0;
    const localStartX = -extStart;
    const localEndX = length + extEnd;
    const frameLen = Math.max(0.01, localEndX - localStartX);

    const profileW = 0.035; // 35mm profile face width
    const profileD = Math.max(thickness + 0.008, 0.035); // 4mm protrusion on both faces
    const innerW = Math.max(0.01, frameLen - profileW * 2);
    const innerH = Math.max(0.01, maxHeight - profileW * 2);
    const frameCenterX = (localStartX + localEndX) / 2;

    const addBar = (w: number, h: number, d: number, cx: number, cy: number) => {
      if (w <= 0 || h <= 0 || d <= 0) return;
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, frameMat);
      this.materials.register(mesh, 'frame');
      mesh.position.set(cx, cy, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { type: 'wall_frame', id: wall.id, wall, section: 'edges' };
      const edges = new THREE.EdgesGeometry(geom, 25);
      const edgeLine = new THREE.LineSegments(edges, this.materials.getEdgeMaterial());
      mesh.add(edgeLine);
      frameGroup.add(mesh);
    };

    // 1. Perimeter posts & rails
    // Left post
    addBar(profileW, maxHeight, profileD, localStartX + profileW / 2, maxHeight / 2);
    // Right post
    addBar(profileW, maxHeight, profileD, localEndX - profileW / 2, maxHeight / 2);
    // Bottom rail
    addBar(innerW, profileW, profileD, frameCenterX, profileW / 2);
    // Top rail
    addBar(innerW, profileW, profileD, frameCenterX, maxHeight - profileW / 2);

    // 2. Interior grid mullions / dividers
    const style = wall.frameStyle;
    const mullionW = 0.024;
    const mullionD = profileD * 0.96;

    if (style && FRAME_DIVIDER_STRATEGIES[style]) {
      FRAME_DIVIDER_STRATEGIES[style]!(innerW, innerH, profileW, frameLen, mullionW, mullionD, addBar);
    }

    return frameGroup;
  }

  buildWallBaseboard(
    wall: WallEntity,
    length: number,
    thickness: number,
    angle: number,
    openings: WallOpeningCut[] = []
  ): THREE.Group {
    const baseboardGroup = new THREE.Group();
    baseboardGroup.name = `baseboard_${wall.id}`;
    baseboardGroup.userData = { type: 'wall_baseboard', id: wall.id, wall, section: 'baseboard' };
    baseboardGroup.position.set(wall.p1.x, 0, wall.p1.y);
    baseboardGroup.rotation.y = -angle;

    const baseboardH = 0.08; // 8cm high standard baseboard
    const baseboardThick = 0.015; // 1.5cm projection from wall face
    const halfH = baseboardH / 2;

    const baseboardMat = this.materials.baseboard(wall);

    // Openings that touch or are near the floor cut out baseboard
    const floorCuts = (openings || [])
      .filter((o) => o.floorHeight <= 0.05)
      .map((o) => ({ start: Math.max(0, o.start), end: Math.min(length, o.end) }))
      .sort((a, b) => a.start - b.start);

    // Merge overlapping cuts
    const mergedCuts: { start: number; end: number }[] = [];
    for (const cut of floorCuts) {
      if (mergedCuts.length === 0) {
        mergedCuts.push({ ...cut });
      } else {
        const prev = mergedCuts[mergedCuts.length - 1];
        if (cut.start <= prev.end + 0.01) {
          prev.end = Math.max(prev.end, cut.end);
        } else {
          mergedCuts.push({ ...cut });
        }
      }
    }

    // Determine continuous baseboard spans
    const spans: { start: number; end: number }[] = [];
    let curX = 0;
    for (const cut of mergedCuts) {
      if (cut.start > curX + 0.02) {
        spans.push({ start: curX, end: cut.start });
      }
      curX = Math.max(curX, cut.end);
    }
    if (length > curX + 0.02) {
      spans.push({ start: curX, end: length });
    }

    if (spans.length === 0) return baseboardGroup;

    // Room-facing sides: Side A (+Z) and Side B (-Z)
    const sides: ('A' | 'B')[] = [];
    if (wall.roomSideA) sides.push('A');
    if (wall.roomSideB) sides.push('B');
    if (sides.length === 0) {
      sides.push('A', 'B'); // Default to both sides if room sides not assigned
    }

    for (const side of sides) {
      const zOffset = side === 'A'
        ? (thickness / 2 + baseboardThick / 2)
        : (-thickness / 2 - baseboardThick / 2);

      for (const span of spans) {
        const spanLen = span.end - span.start;
        if (spanLen < 0.02) continue;

        const geom = new THREE.BoxGeometry(spanLen, baseboardH, baseboardThick);
        const mesh = new THREE.Mesh(geom, baseboardMat);
        this.materials.register(mesh, 'baseboard');
        mesh.userData = { type: 'wall', id: wall.id, wall, section: 'baseboard' };
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const localCenterX = span.start + spanLen / 2;
        mesh.position.set(localCenterX, halfH, zOffset);

        const edges = new THREE.EdgesGeometry(geom, 25);
        const edgeLine = new THREE.LineSegments(edges, this.materials.getEdgeMaterial());
        mesh.add(edgeLine);

        baseboardGroup.add(mesh);
      }
    }

    return baseboardGroup;
  }
}
