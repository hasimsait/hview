import { PlanDocument } from '@core/types/plan';
import * as THREE from 'three';
import { SurfaceMaterialFactory } from "../materials/SurfaceMaterialFactory";
import { roomCeilingHeight, roomCeilingType } from '../../domain/model/Ceiling';

export class CeilingMeshBuilder {
  private edgeMaterial: THREE.LineBasicMaterial;

  get palette(): readonly THREE.Material[] { return [this.edgeMaterial]; }

  constructor(private finishService: SurfaceMaterialFactory) {
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x334155,
      linewidth: 1,
      transparent: true,
      opacity: 0.6,
    });
  }

  buildCeilings(plan: PlanDocument, isolatedRoomIds?: string[]): THREE.Group {
    const group = new THREE.Group();
    group.name = 'ceilingsGroup';
    // CEILINGS ARE COMPLETELY OFF BY DEFAULT so top-down and orbit planning views remain unobstructed!
    group.visible = false;

    const totalH = plan.totalHeight || 2.7;

    for (const room of plan.rooms) {
      if (!room.polygon || room.polygon.length < 3 || room.area < 0.5) continue;
      const ceilingVariant = roomCeilingType(room);
      if (ceilingVariant === 'none') continue;
      if (isolatedRoomIds && isolatedRoomIds.length > 0 && !isolatedRoomIds.includes(room.id)) {
        continue;
      }

      const shape = new THREE.Shape();
      shape.moveTo(room.polygon[0].x, -room.polygon[0].y);
      for (let i = 1; i < room.polygon.length; i++) {
        shape.lineTo(room.polygon[i].x, -room.polygon[i].y);
      }
      shape.closePath();

      const height = roomCeilingHeight(room, totalH), drop = Math.max(0, totalH - height);
      // The underside is at finished height; perimeter faces close the drop to the shared structural level.
      const geom = drop > .00001 ? new THREE.ExtrudeGeometry(shape, { depth: drop, bevelEnabled: false, steps: 1 }) : new THREE.ShapeGeometry(shape);

      // Anchor ceiling UVs to start at (0, 0) at the room's bounding corner for usage estimation
      let minX = Infinity;
      let minY = Infinity;
      for (const p of room.polygon) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
      }
      const uvAttr = geom.attributes.uv;
      const posAttr = geom.attributes.position;
      for (let i = 0; i < uvAttr.count; i++) {
        const px = posAttr.getX(i);
        const py = posAttr.getY(i);
        uvAttr.setXY(i, px - minX, -py - minY);
      }
      uvAttr.needsUpdate = true;

      const mat = this.finishService.getMaterial(
        {
          type: ceilingVariant === 'clip_in' ? 'ceiling' : 'plaster',
          variant: ceilingVariant,
          color: ceilingVariant === 'clip_in' ? '#f1f5f9' : '#ffffff',
        },
        { side: THREE.DoubleSide }
      );

      const fascia = this.finishService.getMaterial({ type: 'plaster', color: '#ffffff' }, { side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geom, drop > .00001 ? [mat, fascia] : mat);
      mesh.name = `ceiling_${room.id}`;
      mesh.userData = { type: 'ceiling', id: room.id, room, ceilingHeight: height, drop };
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = height;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const edges = new THREE.EdgesGeometry(geom, 25);
      const edgeLine = new THREE.LineSegments(edges, this.edgeMaterial);
      mesh.add(edgeLine);

      group.add(mesh);
    }

    return group;
  }
}
