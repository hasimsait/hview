import { AssetCatalog } from '../catalog/AssetCatalog';
import { Column } from '../elements/Column';
import { BasinCabinet,Luminaire,Shelving,StandardFurniture } from '../elements/Furniture';
import type { PlanElement } from '../elements/PlanElement';
import { Wall } from '../elements/Wall';
import { PlanElementFactory } from '../factories/PlanElementFactory';
import { PlanDocument } from '../model/PlanDocument';
import { WallRecess, type RecessHost } from '../elements/WallRecess';
import { readLegacyRecess } from './LegacyRecessReader';
import { legacyMetadata } from './LegacyMetadata';
import { LegacyPlanReader } from './LegacyPlanReader';
import { PlanEncoder } from './PlanEncoder';
import { envelopeSchema,legacyDocumentSchema } from './PlanSchema';

export class PlanCodec {
  readonly factory: PlanElementFactory;
  private readonly legacy: LegacyPlanReader;
  private readonly encoder = new PlanEncoder();

  constructor(catalog = new AssetCatalog()) {
    this.factory = new PlanElementFactory(catalog);
    this.legacy = new LegacyPlanReader(catalog);
  }

  decode(input: string | unknown): PlanDocument {
    if (input instanceof PlanDocument) return input;
    const raw: unknown = typeof input === 'string' ? JSON.parse(input) : input;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Plan must be a JSON object');
    if ('schemaVersion' in raw) {
      if (raw.schemaVersion !== 1) throw new Error(`Unsupported HView schema version: ${raw.schemaVersion}`);
      const { document } = envelopeSchema.parse(raw);
      const elements = document.elements.map((entry): PlanElement => {
        switch (entry.kind) {
          case 'wall': return this.factory.wall(entry.data);
          case 'column': return this.factory.column(entry.data);
          case 'room': return this.factory.room(entry.data);
          case 'furniture.standard': return this.factory.catalog.behavior(entry.data.assetKey) === 'recess' ? this.factory.furniture(entry.data) : new StandardFurniture(entry.data);
          case 'furniture.recess': return new WallRecess(entry.data);
          case 'furniture.luminaire': return new Luminaire(entry.data);
          case 'furniture.shelving': return new Shelving(entry.data);
          case 'furniture.basin': return new BasinCabinet(entry.data);
        }
      });
      // Previous canonical files encoded recesses as ordinary furniture with raw host metadata.
      const hosts = elements.flatMap<RecessHost>(element => element instanceof Wall ? [element] : element instanceof Column ? [element.wallShape(document.totalHeight)] : []);
      const legacyRecessIds = new Set(document.elements.filter(entry => entry.kind === 'furniture.standard' && this.factory.catalog.behavior(entry.data.assetKey) === 'recess').map(entry => entry.data.id));
      const migrated = elements.map(element => element instanceof WallRecess && legacyRecessIds.has(element.id)
        ? readLegacyRecess(element.toData(), hosts) : element);
      return new PlanDocument(migrated, document.totalHeight, document.version, document.extensions);
    }
    const data = legacyDocumentSchema.parse(this.legacy.parse(raw));
    const elements: PlanElement[] = [];
    for (const wall of data.walls) {
      if (wall.isColumn) {
        const dx = wall.p2.x - wall.p1.x, dy = wall.p2.y - wall.p1.y;
        elements.push(new Column({
          id: wall.id, name: 'Column', type: 'column',
          width: Math.hypot(dx, dy), depth: wall.thickness, height: wall.height,
          worldPos: { x: (wall.p1.x + wall.p2.x) / 2, y: 0, z: (wall.p1.y + wall.p2.y) / 2 },
          rotationY: -Math.atan2(dy, dx), roomIds: wall.roomIds,
          roomId: wall.roomSideA ?? wall.roomSideB ?? wall.roomIds?.[0], finish: wall.finish,
          finishFront: wall.finishSideA, finishBack: wall.finishSideB,
          finishLeft: wall.finishEdgeStart, finishRight: wall.finishEdgeEnd
        }));
      } else elements.push(this.factory.wall(wall));
    }
    elements.push(...data.rooms.map(room => this.factory.room(room)));
    const hosts = elements.flatMap<RecessHost>(element => element instanceof Wall ? [element] : element instanceof Column ? [element.wallShape(data.totalHeight)] : []);
    for (const dataItem of data.furniture) {
      const item = this.factory.furniture(dataItem);
      elements.push(item instanceof WallRecess ? readLegacyRecess(item.toData(), hosts) : item);
    }
    return new PlanDocument(elements, data.totalHeight, data.version, legacyMetadata(data.rawPlan));
  }

  encode(document: PlanDocument): string {
    return JSON.stringify({
      schemaVersion: 1, document: {
        version: document.version, totalHeight: document.totalHeight,
        elements: document.elements.map(element => element.accept(this.encoder)), extensions: document.rawPlan,
      }
    }, null, 2);
  }
}
