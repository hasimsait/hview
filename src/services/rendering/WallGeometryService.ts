import * as THREE from 'three';
import { WallEntity, WallFrameStyle } from '@core/types/plan';
import { SurfaceFinishService } from './SurfaceFinishService';

export interface WallOpeningCut {
  start: number;
  end: number;
  width: number;
  floorHeight: number;
  topHeight: number;
  opening?: any;
  isRecess?: boolean;
}

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

export class WallGeometryService {
  private wallMaterial: THREE.MeshStandardMaterial;
  private edgeMaterial: THREE.LineBasicMaterial;
  private finishService: SurfaceFinishService;
  private wallUniforms = {
    uOrbitCenter: { value: new THREE.Vector3(0, 0, 0) },
    uCameraDir: { value: new THREE.Vector3(0, 0, 1) },
    uForegroundMode: { value: 1 }, // 0 = solid, 1 = transparent foreground, 2 = clip section
    uForegroundOpacity: { value: 0.15 },
  };

  constructor(finishService: SurfaceFinishService) {
    this.finishService = finishService;
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x0f172a,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xefede8, // Warm off-white architectural plaster
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: true,
    });

    // Custom shader hook for dynamic foreground transparency relative to orbit center
    this.wallMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uOrbitCenter = this.wallUniforms.uOrbitCenter;
      shader.uniforms.uCameraDir = this.wallUniforms.uCameraDir;
      shader.uniforms.uForegroundMode = this.wallUniforms.uForegroundMode;
      shader.uniforms.uForegroundOpacity = this.wallUniforms.uForegroundOpacity;

      // Vertex shader: pass world position
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCustomWorldPos;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 customWPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          customWPos = instanceMatrix * customWPos;
        #endif
        vCustomWorldPos = (modelMatrix * customWPos).xyz;`
      );

      // Fragment shader: fade or clip fragments on the closer-to-camera side of orbit center
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uOrbitCenter;
        uniform vec3 uCameraDir;
        uniform int uForegroundMode;
        uniform float uForegroundOpacity;
        varying vec3 vCustomWorldPos;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        if (uForegroundMode > 0) {
          float dist = dot(vCustomWorldPos - uOrbitCenter, uCameraDir);
          if (dist > 0.0) {
            if (uForegroundMode == 1) {
              // Smoothly fade walls on the closer-to-camera side of orbit:
              float fade = smoothstep(0.0, 0.5, dist);
              gl_FragColor.a *= mix(1.0, uForegroundOpacity, fade);
            } else if (uForegroundMode == 2) {
              if (dist > 0.1) discard;
            }
          }
        }`
      );
    };
  }

  getMaterial(): THREE.MeshStandardMaterial {
    return this.wallMaterial;
  }

  getEdgeMaterial(): THREE.LineBasicMaterial {
    return this.edgeMaterial;
  }

  setWallOpacity(opacity: number): void {
    const op = opacity < 1.0 ? opacity : 0.15;
    this.wallUniforms.uForegroundOpacity.value = op;
    this.finishService.setForegroundOpacity(op);
  }

  updateOrbitPlane(orbitCenter: THREE.Vector3, cameraDir: THREE.Vector3): void {
    this.wallUniforms.uOrbitCenter.value.copy(orbitCenter);
    this.wallUniforms.uCameraDir.value.copy(cameraDir);
    this.finishService.updateOrbitPlane(orbitCenter, cameraDir);
  }

  setForegroundMode(mode: 'off' | 'transparent' | 'clip'): void {
    const val = mode === 'transparent' ? 1 : mode === 'clip' ? 2 : 0;
    this.wallUniforms.uForegroundMode.value = val;
    this.finishService.setForegroundMode(mode);
  }

  setCelShading(enabled: boolean): void {
    this.edgeMaterial.color.set(enabled ? 0x000000 : 0x0f172a);
    this.edgeMaterial.opacity = enabled ? 1.0 : 0.6;
    this.edgeMaterial.needsUpdate = true;
  }

  getMaterialForSide(wall: WallEntity, side: 'A' | 'B'): THREE.Material {
    const sideFinish = side === 'A' ? wall.finishSideA : wall.finishSideB;
    if (sideFinish) {
      return this.finishService.getMaterial(sideFinish, { side: THREE.FrontSide });
    }
    if (wall.finish) {
      return this.finishService.getMaterial(wall.finish, { side: THREE.FrontSide });
    }
    if (wall.material === 'a_glass' || wall.material === 'glass') {
      return this.finishService.getMaterial({ type: 'glass', variant: 'frosted_mica' }, { side: THREE.FrontSide });
    }
    if (wall.color) {
      return this.finishService.getMaterial({ type: 'paint', color: wall.color }, { side: THREE.FrontSide });
    }
    if (wall.material === 'a_brick') {
      return this.finishService.getMaterial({ type: 'plaster', variant: 'brick', color: '#dfd3c3' }, { side: THREE.FrontSide });
    }
    return this.wallMaterial;
  }

  getMaterialForWall(wall: WallEntity): THREE.Material {
    return this.getMaterialForSide(wall, 'A');
  }

  getMaterialForEdges(wall: WallEntity): THREE.Material {
    if (wall.finishEdges) {
      return this.finishService.getMaterial(wall.finishEdges, { side: THREE.FrontSide });
    }
    if (wall.finish) {
      return this.finishService.getMaterial(wall.finish, { side: THREE.FrontSide });
    }
    if (wall.finishSideA && wall.finishSideB) {
      return this.finishService.getMaterial(wall.finishSideA, { side: THREE.FrontSide });
    }
    if (wall.finishSideA) {
      return this.finishService.getMaterial(wall.finishSideA, { side: THREE.FrontSide });
    }
    if (wall.finishSideB) {
      return this.finishService.getMaterial(wall.finishSideB, { side: THREE.FrontSide });
    }
    if (wall.material === 'a_glass' || wall.material === 'glass') {
      return this.finishService.getMaterial({ type: 'glass', variant: 'frosted_mica' }, { side: THREE.FrontSide });
    }
    if (wall.color) {
      return this.finishService.getMaterial({ type: 'paint', color: wall.color }, { side: THREE.FrontSide });
    }
    if (wall.material === 'a_brick') {
      return this.finishService.getMaterial({ type: 'plaster', variant: 'brick', color: '#dfd3c3' }, { side: THREE.FrontSide });
    }
    return this.wallMaterial;
  }

  /**
   * Sort geometry triangles into distinct material groups:
   * Group 0: Side A (+Z normal face)
   * Group 1: Side B (-Z normal face)
   * Group 2: Edge Start (end cap face at p1, local -X normal)
   * Group 3: Edge End (end cap face at p2, local +X normal)
   * Group 4: Edge Top (top sill, local +Y normal)
   * Group 5: Doorway/window jambs and bottom face
   */
  private applyMultiMaterialGroups(
    geom: THREE.BufferGeometry,
    isStart: boolean = true,
    isEnd: boolean = true,
    _maxHeight: number = 2.7,
    omitJambs?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean }
  ): void {
    const posAttr = geom.getAttribute('position');
    if (!posAttr) return;

    let indexAttr = geom.getIndex();
    if (!indexAttr) {
      const indices: number[] = [];
      for (let i = 0; i < posAttr.count; i++) indices.push(i);
      geom.setIndex(indices);
      indexAttr = geom.getIndex()!;
    }

    const indices = Array.from(indexAttr.array);
    const indicesSideA: number[] = [];
    const indicesSideB: number[] = [];
    const indicesEdgeStart: number[] = [];
    const indicesEdgeEnd: number[] = [];
    const indicesEdgeTop: number[] = [];
    const indicesJambs: number[] = [];

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();
    const cb = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const center = new THREE.Vector3();

    // Compute bounding box for thresholding
    geom.computeBoundingBox();
    const bb = geom.boundingBox || new THREE.Box3();
    const minX = bb.min.x;
    const maxX = bb.max.x;
    const maxY = bb.max.y;

    for (let i = 0; i < indices.length; i += 3) {
      const idxA = indices[i];
      const idxB = indices[i + 1];
      const idxC = indices[i + 2];

      vA.fromBufferAttribute(posAttr, idxA);
      vB.fromBufferAttribute(posAttr, idxB);
      vC.fromBufferAttribute(posAttr, idxC);

      center.addVectors(vA, vB).add(vC).divideScalar(3);

      cb.subVectors(vC, vB);
      ab.subVectors(vA, vB);
      cb.cross(ab).normalize();

      if (cb.z > 0.5) {
        indicesSideA.push(idxA, idxB, idxC);
      } else if (cb.z < -0.5) {
        indicesSideB.push(idxA, idxB, idxC);
      } else if (cb.x < -0.5 && center.x <= minX + 0.02) {
        if (isStart) {
          indicesEdgeStart.push(idxA, idxB, idxC);
        } else if (!omitJambs?.left) {
          indicesJambs.push(idxA, idxB, idxC);
        }
      } else if (cb.x > 0.5 && center.x >= maxX - 0.02) {
        if (isEnd) {
          indicesEdgeEnd.push(idxA, idxB, idxC);
        } else if (!omitJambs?.right) {
          indicesJambs.push(idxA, idxB, idxC);
        }
      } else if (cb.y > 0.5 && center.y >= maxY - 0.02) {
        if (!omitJambs?.top) {
          indicesEdgeTop.push(idxA, idxB, idxC);
        }
      } else {
        if (!omitJambs?.bottom) {
          indicesJambs.push(idxA, idxB, idxC);
        }
      }
    }

    const newIndices = [
      ...indicesSideA,
      ...indicesSideB,
      ...indicesEdgeStart,
      ...indicesEdgeEnd,
      ...indicesEdgeTop,
      ...indicesJambs,
    ];
    geom.setIndex(newIndices);
    geom.clearGroups();

    let offset = 0;
    const groups = [
      indicesSideA,     // 0: Side A
      indicesSideB,     // 1: Side B
      indicesEdgeStart, // 2: Edge Start
      indicesEdgeEnd,   // 3: Edge End
      indicesEdgeTop,   // 4: Edge Top
      indicesJambs,     // 5: Jambs / Bottom
    ];

    for (let g = 0; g < groups.length; g++) {
      if (groups[g].length > 0) {
        geom.addGroup(offset, groups[g].length, g);
        offset += groups[g].length;
      }
    }
  }

  buildWall(
    wall: WallEntity,
    cutawayHeight?: number,
    cutouts?: { start: number; end: number }[],
    recessHoles?: { start: number; end: number; floorHeight: number; topHeight: number }[]
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `wall_${wall.id}`;
    group.userData = { type: 'wall', id: wall.id, wall };

    const dx = wall.p2.x - wall.p1.x;
    const dz = wall.p2.y - wall.p1.y; // 2D y is 3D z
    const length = Math.hypot(dx, dz);
    if (length < 0.02) return group;

    const angle = Math.atan2(dz, dx);
    const thickness = wall.thickness || 0.1;
    const maxHeight = cutawayHeight !== undefined ? Math.min(wall.height, cutawayHeight) : wall.height;

    // Corner junction trimming: non-penetrating offsets computed by WallJunctionService
    const extStart = wall.startOffset !== undefined ? wall.startOffset : 0;
    const extEnd = wall.endOffset !== undefined ? wall.endOffset : 0;

    const matSideA = this.getMaterialForSide(wall, 'A');
    const matSideB = this.getMaterialForSide(wall, 'B');
    const matEdgeStart = wall.finishEdgeStart
      ? this.finishService.getMaterial(wall.finishEdgeStart, { side: THREE.FrontSide })
      : this.getMaterialForEdges(wall);
    const matEdgeEnd = wall.finishEdgeEnd
      ? this.finishService.getMaterial(wall.finishEdgeEnd, { side: THREE.FrontSide })
      : this.getMaterialForEdges(wall);
    const matEdgeTop = wall.finishEdgeTop
      ? this.finishService.getMaterial(wall.finishEdgeTop, { side: THREE.FrontSide })
      : this.getMaterialForEdges(wall);
    const matJambs = this.getMaterialForEdges(wall);

    const wallMaterials = [
      matSideA,        // 0: Side A
      matSideB,        // 1: Side B
      matEdgeStart,    // 2: Edge Start (p1)
      matEdgeEnd,      // 3: Edge End (p2)
      matEdgeTop,      // 4: Edge Top (sill)
      matJambs,        // 5: Doorway/window jambs & bottom
    ];

    // Filter and clamp openings within wall span
    const openings: WallOpeningCut[] = (wall.openings || [])
      .map((o) => {
        const start = Math.max(0, o.distanceAlongWall - o.width / 2);
        const end = Math.min(length, o.distanceAlongWall + o.width / 2);
        return {
          start,
          end,
          width: Math.max(0.01, end - start),
          floorHeight: o.floorHeight,
          topHeight: Math.min(maxHeight, o.floorHeight + o.height),
          opening: o,
          isRecess: false,
        };
      })
      .filter((o) => o.start < length && o.end > 0 && o.floorHeight < maxHeight);

    // Merge recess holes directly as opening cutouts
    if (recessHoles && recessHoles.length > 0) {
      for (const rh of recessHoles) {
        const start = Math.max(0, rh.start);
        const end = Math.min(length, rh.end);
        const floorHeight = Math.max(0, rh.floorHeight);
        const topHeight = Math.min(maxHeight, rh.topHeight);
        if (end > start + 0.01 && topHeight > floorHeight + 0.01) {
          openings.push({
            start,
            end,
            width: end - start,
            floorHeight,
            topHeight,
            isRecess: true,
          });
        }
      }
    }
    openings.sort((a, b) => a.start - b.start);

    // If no openings and no cutouts, single clean box
    if (openings.length === 0 && (!cutouts || cutouts.length === 0)) {
      const localStartX = -extStart;
      const localEndX = length + extEnd;
      const boxLen = Math.max(0.01, localEndX - localStartX);
      const halfL = boxLen / 2;
      const halfH = maxHeight / 2;

      const geom = new THREE.BoxGeometry(boxLen, maxHeight, thickness);
      const uvAttr = geom.attributes.uv;
      const posAttr = geom.attributes.position;
      const normAttr = geom.attributes.normal;
      for (let i = 0; i < uvAttr.count; i++) {
        const ny = Math.abs(normAttr.getY(i));
        const nz = Math.abs(normAttr.getZ(i));
        const px = posAttr.getX(i);
        const py = posAttr.getY(i);
        const pz = posAttr.getZ(i);

        if (nz >= 0.707) {
          // Metric coordinates along wall from p1: px + halfL + localStartX
          uvAttr.setXY(i, px + halfL + localStartX, py + halfH);
        } else if (ny >= 0.707) {
          uvAttr.setXY(i, px + halfL + localStartX, pz + thickness / 2);
        } else {
          uvAttr.setXY(i, pz + thickness / 2, py + halfH);
        }
      }
      uvAttr.needsUpdate = true;

      this.applyMultiMaterialGroups(geom, true, true, maxHeight);
      const mesh = new THREE.Mesh(geom, wallMaterials);
      mesh.userData = { type: 'wall', id: wall.id, wall };
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const localCenterX = (localStartX + localEndX) / 2;
      const localCenterY = maxHeight / 2;
      const worldX = wall.p1.x + Math.cos(angle) * localCenterX;
      const worldZ = wall.p1.y + Math.sin(angle) * localCenterX;
      mesh.position.set(worldX, localCenterY, worldZ);
      mesh.rotation.y = -angle;

      const edges = new THREE.EdgesGeometry(geom, 25);
      const edgeLine = new THREE.LineSegments(edges, this.edgeMaterial);
      mesh.add(edgeLine);

      group.add(mesh);
      if (wall.frameStyle && wall.frameStyle !== 'none') {
        const frameGroup = this.buildWallFrame(wall, length, maxHeight, thickness, angle);
        group.add(frameGroup);
      }
      if (wall.finishBaseboard) {
        const baseboardGroup = this.buildWallBaseboard(wall, length, thickness, angle, openings);
        group.add(baseboardGroup);
      }
      return group;
    }

    // Full-height cuts (e.g. doors in cutaway mode where topHeight >= maxHeight, or column cutouts)
    const fullCuts = openings
      .filter((o) => o.floorHeight <= 0.01 && o.topHeight >= maxHeight - 0.01)
      .map((o) => ({ start: o.start, end: o.end }));

    // Add extra cutouts (columns, overlapping walls) to fullCuts so wall does not render there
    if (cutouts && cutouts.length > 0) {
      for (const cut of cutouts) {
        const s = Math.max(0, cut.start);
        const e = Math.min(length, cut.end);
        if (e - s > 0.005) {
          fullCuts.push({ start: s, end: e });
        }
      }
      fullCuts.sort((a, b) => a.start - b.start);
    }

    const internalOpenings = openings.filter((o) => !(o.floorHeight <= 0.01 && o.topHeight >= maxHeight - 0.01));

    // Divide wall into continuous segments between full-height cuts
    const segRanges: { start: number; end: number }[] = [];
    let curX = 0;
    for (const cut of fullCuts) {
      if (cut.start > curX + 0.01) {
        segRanges.push({ start: curX, end: cut.start });
      }
      curX = Math.max(curX, cut.end);
    }
    if (curX < length - 0.01) {
      segRanges.push({ start: curX, end: length });
    }

    for (const seg of segRanges) {
      const isWallStart = seg.start === 0;
      const isWallEnd = seg.end === length;
      const segExtStart = isWallStart ? -extStart : seg.start;
      const segExtEnd = isWallEnd ? length + extEnd : seg.end;
      const segLen = Math.max(0.01, segExtEnd - segExtStart);
      if (segLen <= 0.01) continue;

      const segOps = internalOpenings.filter((o) => o.start >= seg.start - 0.01 && o.end <= seg.end + 0.01);

      if (segOps.length === 0) {
        const geom = new THREE.BoxGeometry(segLen, maxHeight, thickness);
        const halfSeg = segLen / 2;
        const halfH = maxHeight / 2;
        const uvAttr = geom.attributes.uv;
        const posAttr = geom.attributes.position;
        const normAttr = geom.attributes.normal;
        for (let i = 0; i < uvAttr.count; i++) {
          const ny = Math.abs(normAttr.getY(i));
          const nz = Math.abs(normAttr.getZ(i));
          const px = posAttr.getX(i);
          const py = posAttr.getY(i);
          const pz = posAttr.getZ(i);

          if (nz >= 0.707) {
            uvAttr.setXY(i, px + halfSeg + Math.max(0, segExtStart), py + halfH);
          } else if (ny >= 0.707) {
            uvAttr.setXY(i, px + halfSeg + Math.max(0, segExtStart), pz + thickness / 2);
          } else {
            uvAttr.setXY(i, pz + thickness / 2, py + halfH);
          }
        }
        uvAttr.needsUpdate = true;

        this.applyMultiMaterialGroups(geom, isWallStart, isWallEnd, maxHeight);
        const mesh = new THREE.Mesh(geom, wallMaterials);
        mesh.userData = { type: 'wall', id: wall.id, wall };
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const localCenterX = segExtStart + segLen / 2;
        const localCenterY = maxHeight / 2;
        const worldX = wall.p1.x + Math.cos(angle) * localCenterX;
        const worldZ = wall.p1.y + Math.sin(angle) * localCenterX;
        mesh.position.set(worldX, localCenterY, worldZ);
        mesh.rotation.y = -angle;

        const edges = new THREE.EdgesGeometry(geom, 25);
        const edgeLine = new THREE.LineSegments(edges, this.edgeMaterial);
        mesh.add(edgeLine);

        group.add(mesh);
        continue;
      }

      // Clean BoxGeometry decomposition: eliminates concave polygon extrusion and diagonal triangulation lines
      segOps.sort((a, b) => a.start - b.start);

      interface WallBlock {
        startX: number;
        endX: number;
        startY: number;
        endY: number;
        isStart: boolean;
        isEnd: boolean;
        omitTopJamb?: boolean;
        omitBottomJamb?: boolean;
        omitLeftJamb?: boolean;
        omitRightJamb?: boolean;
      }

      const blocks: WallBlock[] = [];
      let curBlockX = segExtStart;

      for (let i = 0; i < segOps.length; i++) {
        const op = segOps[i];
        const isFirst = i === 0;
        const isLast = i === segOps.length - 1;

        // Pier before opening
        if (op.start > curBlockX + 0.005) {
          const prevOp = i > 0 ? segOps[i - 1] : undefined;
          blocks.push({
            startX: curBlockX,
            endX: op.start,
            startY: 0,
            endY: maxHeight,
            isStart: isWallStart && curBlockX <= segExtStart + 0.001,
            isEnd: false,
            omitLeftJamb: prevOp?.isRecess,
            omitRightJamb: op.isRecess,
          });
        }

        // Span of opening: if opening reaches wall start/end, snap to segment start/end
        const blockStartX = isFirst && op.start - segExtStart <= 0.005 ? segExtStart : op.start;
        const blockEndX = isLast && segExtEnd - op.end <= 0.005 ? segExtEnd : op.end;

        // Sill below window or recess
        if (op.floorHeight > 0.01) {
          blocks.push({
            startX: blockStartX,
            endX: blockEndX,
            startY: 0,
            endY: op.floorHeight,
            isStart: isWallStart && blockStartX <= segExtStart + 0.001,
            isEnd: isWallEnd && blockEndX >= segExtEnd - 0.001,
            omitTopJamb: op.isRecess,
          });
        }

        // Lintel above door, window, or recess
        if (op.topHeight < maxHeight - 0.005) {
          blocks.push({
            startX: blockStartX,
            endX: blockEndX,
            startY: op.topHeight,
            endY: maxHeight,
            isStart: isWallStart && blockStartX <= segExtStart + 0.001,
            isEnd: isWallEnd && blockEndX >= segExtEnd - 0.001,
            omitBottomJamb: op.isRecess,
          });
        }

        curBlockX = blockEndX;
      }

      // Pier after last opening
      if (segExtEnd > curBlockX + 0.005) {
        const lastOp = segOps[segOps.length - 1];
        blocks.push({
          startX: curBlockX,
          endX: segExtEnd,
          startY: 0,
          endY: maxHeight,
          isStart: false,
          isEnd: isWallEnd,
          omitLeftJamb: lastOp?.isRecess,
        });
      }

      // Create meshes for each rectangular block
      for (const b of blocks) {
        const bW = Math.max(0.005, b.endX - b.startX);
        const bH = Math.max(0.005, b.endY - b.startY);
        const geom = new THREE.BoxGeometry(bW, bH, thickness);
        const halfW = bW / 2;
        const halfH = bH / 2;

        const uvAttr = geom.attributes.uv;
        const posAttr = geom.attributes.position;
        const normAttr = geom.attributes.normal;
        for (let i = 0; i < uvAttr.count; i++) {
          const ny = Math.abs(normAttr.getY(i));
          const nz = Math.abs(normAttr.getZ(i));
          const px = posAttr.getX(i);
          const py = posAttr.getY(i);
          const pz = posAttr.getZ(i);

          if (nz >= 0.707) {
            uvAttr.setXY(i, px + halfW + b.startX, py + halfH + b.startY);
          } else if (ny >= 0.707) {
            uvAttr.setXY(i, px + halfW + b.startX, pz + thickness / 2);
          } else {
            uvAttr.setXY(i, pz + thickness / 2, py + halfH + b.startY);
          }
        }
        uvAttr.needsUpdate = true;

        this.applyMultiMaterialGroups(geom, b.isStart, b.isEnd, maxHeight, {
          top: b.omitTopJamb,
          bottom: b.omitBottomJamb,
          left: b.omitLeftJamb,
          right: b.omitRightJamb,
        });
        const mesh = new THREE.Mesh(geom, wallMaterials);
        mesh.userData = { type: 'wall', id: wall.id, wall };
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const localCenterX = (b.startX + b.endX) / 2;
        const localCenterY = (b.startY + b.endY) / 2;
        const worldX = wall.p1.x + Math.cos(angle) * localCenterX;
        const worldZ = wall.p1.y + Math.sin(angle) * localCenterX;
        mesh.position.set(worldX, localCenterY, worldZ);
        mesh.rotation.y = -angle;

        group.add(mesh);
      }

      // Build clean analytical contour edges for the entire segment (zero diagonal lines)
      const edgeGeom = this.buildSegmentEdges(
        segExtStart,
        segExtEnd,
        thickness,
        maxHeight,
        segOps,
        isWallStart,
        isWallEnd
      );
      const edgeLine = new THREE.LineSegments(edgeGeom, this.edgeMaterial);
      edgeLine.position.set(wall.p1.x, 0, wall.p1.y);
      edgeLine.rotation.y = -angle;
      group.add(edgeLine);
    }

    if (wall.frameStyle && wall.frameStyle !== 'none') {
      const frameGroup = this.buildWallFrame(wall, length, maxHeight, thickness, angle);
      group.add(frameGroup);
    }

    if (wall.finishBaseboard) {
      const baseboardGroup = this.buildWallBaseboard(wall, length, thickness, angle, openings);
      group.add(baseboardGroup);
    }

    return group;
  }

  private buildSegmentEdges(
    startX: number,
    endX: number,
    thickness: number,
    maxHeight: number,
    openings: { start: number; end: number; floorHeight: number; topHeight: number }[],
    isWallStart: boolean,
    isWallEnd: boolean
  ): THREE.BufferGeometry {
    const points: number[] = [];
    const addLine = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
      points.push(x1, y1, z1, x2, y2, z2);
    };

    const halfT = thickness / 2;

    for (const z of [halfT, -halfT]) {
      // Top edge along the entire segment span
      addLine(startX, maxHeight, z, endX, maxHeight, z);

      // Outer vertical end borders (only if wall start/end cap)
      if (isWallStart) addLine(startX, 0, z, startX, maxHeight, z);
      if (isWallEnd) addLine(endX, 0, z, endX, maxHeight, z);

      // Bottom edge along piers and window sills
      let curX = startX;
      for (let i = 0; i < openings.length; i++) {
        const op = openings[i];
        const isFirst = i === 0;
        const isLast = i === openings.length - 1;
        const bStart = isFirst && op.start - startX <= 0.005 ? startX : op.start;
        const bEnd = isLast && endX - op.end <= 0.005 ? endX : op.end;

        if (bStart > curX + 0.005) {
          addLine(curX, 0, z, bStart, 0, z);
        }
        if (op.floorHeight > 0.01) {
          // Bottom edge under window
          addLine(bStart, 0, z, bEnd, 0, z);
          // Window sill edge
          addLine(bStart, op.floorHeight, z, bEnd, op.floorHeight, z);
        }
        if (op.topHeight < maxHeight - 0.005) {
          // Opening lintel soffit header edge
          addLine(bStart, op.topHeight, z, bEnd, op.topHeight, z);
        }
        // Vertical jamb edges on face
        const jBottom = Math.max(0, op.floorHeight);
        const jTop = Math.min(maxHeight, op.topHeight);
        if (jTop > jBottom + 0.005) {
          addLine(bStart, jBottom, z, bStart, jTop, z);
          addLine(bEnd, jBottom, z, bEnd, jTop, z);
        }
        curX = bEnd;
      }
      if (endX > curX + 0.005) {
        addLine(curX, 0, z, endX, 0, z);
      }
    }

    // Cross-wall edges (transverse in Z direction)
    if (isWallStart) {
      addLine(startX, maxHeight, -halfT, startX, maxHeight, halfT);
      addLine(startX, 0, -halfT, startX, 0, halfT);
    }
    if (isWallEnd) {
      addLine(endX, maxHeight, -halfT, endX, maxHeight, halfT);
      addLine(endX, 0, -halfT, endX, 0, halfT);
    }
    for (let i = 0; i < openings.length; i++) {
      const op = openings[i];
      const isFirst = i === 0;
      const isLast = i === openings.length - 1;
      const bStart = isFirst && op.start - startX <= 0.005 ? startX : op.start;
      const bEnd = isLast && endX - op.end <= 0.005 ? endX : op.end;

      if (op.topHeight < maxHeight - 0.005) {
        addLine(bStart, op.topHeight, -halfT, bStart, op.topHeight, halfT);
        addLine(bEnd, op.topHeight, -halfT, bEnd, op.topHeight, halfT);
      }
      if (op.floorHeight > 0.01) {
        addLine(bStart, op.floorHeight, -halfT, bStart, op.floorHeight, halfT);
        addLine(bEnd, op.floorHeight, -halfT, bEnd, op.floorHeight, halfT);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geom;
  }

  private getFrameMaterial(colorHex?: string): THREE.Material {
    const hex = (colorHex || '#18181b').toLowerCase();
    let variant = 'matte_black_powder';
    if (hex === '#ffffff' || hex === '#f8fafc' || hex === '#f1f5f9') {
      variant = 'matte_white_powder';
    } else if (
      hex === '#d4af37' ||
      hex === '#ebd48e' ||
      hex === '#d4b359' ||
      hex === '#ffd700' ||
      hex === '#b8860b'
    ) {
      variant = 'brass_brushed';
    } else if (
      hex === '#cbd5e1' ||
      hex === '#e2e8f0' ||
      hex === '#cccccc'
    ) {
      variant = 'chrome_satin';
    }
    return this.finishService.getMaterial(
      {
        type: 'metal',
        variant,
        color: hex,
      },
      { side: THREE.FrontSide }
    );
  }

  private buildWallFrame(
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

    const frameMat = this.getFrameMaterial(wall.frameColor);
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
      mesh.position.set(cx, cy, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { type: 'wall_frame', id: wall.id, wall };
      const edges = new THREE.EdgesGeometry(geom, 25);
      const edgeLine = new THREE.LineSegments(edges, this.edgeMaterial);
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

  private buildWallBaseboard(
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

    const baseboardMat = wall.finishBaseboard
      ? this.finishService.getMaterial(wall.finishBaseboard, { side: THREE.FrontSide })
      : this.finishService.getMaterial({ type: 'wood', variant: 'natural_oak' }, { side: THREE.FrontSide });

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
        mesh.userData = { type: 'wall', id: wall.id, wall, section: 'baseboard' };
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const localCenterX = span.start + spanLen / 2;
        mesh.position.set(localCenterX, halfH, zOffset);

        const edges = new THREE.EdgesGeometry(geom, 25);
        const edgeLine = new THREE.LineSegments(edges, this.edgeMaterial);
        mesh.add(edgeLine);

        baseboardGroup.add(mesh);
      }
    }

    return baseboardGroup;
  }

}
