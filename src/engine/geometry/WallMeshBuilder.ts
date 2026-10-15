import * as THREE from 'three';
import type { WallEntity } from '../../core/types/plan';
import type { SurfaceMaterialFactory } from '../materials/SurfaceMaterialFactory';
import { WallSurfacePalette } from '../materials/WallSurfacePalette';
import { WallTrimsBuilder } from './WallTrimsBuilder';
export interface WallOpeningCut {
  start: number;
  end: number;
  width: number;
  floorHeight: number;
  topHeight: number;
  opening?: any;
  isRecess?: boolean;
}


export class WallMeshBuilder {
  readonly materials: WallSurfacePalette;
  private readonly trims: WallTrimsBuilder;
  constructor(finishes: SurfaceMaterialFactory) { this.materials = new WallSurfacePalette(finishes); this.trims = new WallTrimsBuilder(this.materials); }
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

    const wallMaterials = this.materials.materialsFor(wall);

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
      this.materials.register(mesh, 'body');
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
      const edgeLine = new THREE.LineSegments(edges, this.materials.getEdgeMaterial());
      mesh.add(edgeLine);

      group.add(mesh);
      if (wall.frameStyle && wall.frameStyle !== 'none') {
        const frameGroup = this.trims.buildWallFrame(wall, length, maxHeight, thickness, angle);
        group.add(frameGroup);
      }
      if (wall.finishBaseboard) {
        const baseboardGroup = this.trims.buildWallBaseboard(wall, length, thickness, angle, openings);
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
        this.materials.register(mesh, 'body');
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
        const edgeLine = new THREE.LineSegments(edges, this.materials.getEdgeMaterial());
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
        this.materials.register(mesh, 'body');
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
      const edgeLine = new THREE.LineSegments(edgeGeom, this.materials.getEdgeMaterial());
      edgeLine.position.set(wall.p1.x, 0, wall.p1.y);
      edgeLine.rotation.y = -angle;
      group.add(edgeLine);
    }

    if (wall.frameStyle && wall.frameStyle !== 'none') {
      const frameGroup = this.trims.buildWallFrame(wall, length, maxHeight, thickness, angle);
      group.add(frameGroup);
    }

    if (wall.finishBaseboard) {
      const baseboardGroup = this.trims.buildWallBaseboard(wall, length, thickness, angle, openings);
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
}
