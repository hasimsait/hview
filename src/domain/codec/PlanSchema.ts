import { z } from 'zod';
import { Shelving } from '../elements/Furniture';

const number = z.number().finite();
const positive = number.positive();
const id = z.string().trim().min(1);
const point = z.object({ x: number, y: number });
const vector = z.object({ x: number, y: number, z: number });
const dimensions = z.object({ x: positive, y: positive, z: positive });
export const finishSchema = z.object({
  type: z.enum(['paint', 'plaster', 'lambri', 'tile', 'glass', 'wood', 'ceiling', 'metal', 'porcelain', 'fabric', 'invisible']),
  variant: z.string().optional(), color: z.string().optional(), roughness: number.min(0).max(1).optional(),
  metalness: number.min(0).max(1).optional(), rotation: number.optional(), layer: number.int().optional(),
  pattern: z.enum(['grid', 'running_bond', 'diagonal_herringbone', 'herringbone', 'french_pattern', 'vertical_stack']).optional(),
  groutWidth: number.nonnegative().optional(), groutColor: z.string().optional(), scale: positive.optional(),
  mappingMode: z.enum(['stretched', 'tiled']).optional(), backingColor: z.string().optional(),
}).passthrough();
const finish = finishSchema.optional();
export const openingSchema = z.object({
  id, type: z.enum(['door', 'door_coupe', 'window', 'french_window']), width: positive, height: positive,
  wallId: id, floorHeight: number.nonnegative(), distanceAlongWall: number, position: point,
  swingSide: z.enum(['r', 'l']).optional(), hingeSide: z.enum(['r', 'l']).optional(),
  swingFlipped: z.boolean().optional(), hingeFlipped: z.boolean().optional(), openAngle: number.min(0).max(180).optional(),
  finish, rawOpening: z.unknown().optional(),
}).passthrough();
export const wallSchema = z.object({
  id, p1: point, p2: point, thickness: positive, height: positive, material: z.string(), openings: z.array(openingSchema),
  isColumn: z.boolean().optional(), color: z.string().optional(), roomIds: z.array(id).optional(),
  roomSideA: id.optional(), roomSideB: id.optional(), startOffset: number.optional(), endOffset: number.optional(),
  finish, finishSideA: finish, finishSideB: finish, finishEdges: finish, finishEdgeStart: finish, finishEdgeEnd: finish,
  finishEdgeTop: finish, finishBaseboard: finish, frameColor: z.string().optional(),
  frameStyle: z.enum(['none', 'perimeter', 'grid_3', 'grid_4', 'grid_2x3']).optional(),
  cavities: z.array(z.object({
    id, distanceAlongWall: number, floorElevation: number,
    width: positive, height: positive, depth: positive, finishBack: finish, finishReturns: finish
  })).optional(),
  rawWall: z.unknown().optional(),
}).passthrough();
export const roomSchema = z.object({
  id, name: z.string(), area: number.nonnegative(), polygon: z.array(point).min(3), height: positive,
  floorType: z.string().optional(), ceilingType: z.enum(['clip_in', 'gypsum', 'none']).optional(),
  floorFinish: finish, wallFinish: finish, rawRoom: z.unknown().optional(),
}).passthrough();
export const columnSchema = z.object({
  id, name: z.string(), type: z.enum(['column', 'chimney']), width: positive, depth: positive,
  height: positive.optional(), area: number.optional(), worldPos: vector, rotationY: number,
  stubIds: z.array(id).optional(), roomId: id.optional(), roomIds: z.array(id).optional(), roomName: z.string().optional(),
  finish, finishFront: finish, finishBack: finish, finishLeft: finish, finishRight: finish,
}).passthrough();
export const furnitureSchema = z.object({
  id, name: z.string(), displayName: z.string(), category: z.enum(['bed', 'seating', 'table', 'storage', 'kitchen', 'bathroom', 'decor', 'appliance', 'fixture']),
  assetKey: id, position: vector, rotationY: number, dimensions, roomId: id.optional(), customModelUrl: z.string().optional(),
  visible: z.boolean().optional(), hasLids: z.boolean().optional(), shelfCount: number.int().min(Shelving.minShelves).max(Shelving.maxShelves).optional(), recessHostId: id.optional(),
  finish, sectionFinishes: z.record(finishSchema).optional(),
  lightConfig: z.object({ enabled: z.boolean().optional(), intensity: number.min(0).max(3).optional(), color: z.string().optional() }).optional(),
  rawItem: z.unknown().optional(),
}).passthrough();
export const legacyDocumentSchema = z.object({
  version: number, totalHeight: positive, walls: z.array(wallSchema), rooms: z.array(roomSchema),
  columns: z.array(columnSchema).optional(), furniture: z.array(furnitureSchema), rawPlan: z.unknown(),
});

const element = <K extends string, S extends z.ZodTypeAny>(kind: K, data: S) => z.object({ kind: z.literal(kind), data });
export const envelopeSchema = z.object({
  schemaVersion: z.literal(1),
  document: z.object({
    version: number, totalHeight: positive, extensions: z.unknown(),
    elements: z.array(z.discriminatedUnion('kind', [
      element('wall', wallSchema), element('column', columnSchema), element('room', roomSchema),
      element('furniture.standard', furnitureSchema), element('furniture.luminaire', furnitureSchema),
      element('furniture.shelving', furnitureSchema), element('furniture.basin', furnitureSchema), element('furniture.recess', furnitureSchema),
    ])),
  }),
});

export type SerializedElement =
  | { kind: 'wall'; data: import('../model/PlanData').WallData }
  | { kind: 'room'; data: import('../model/PlanData').RoomData }
  | { kind: 'column'; data: import('../model/PlanData').ColumnData }
  | { kind: 'furniture.standard' | 'furniture.luminaire' | 'furniture.shelving' | 'furniture.basin' | 'furniture.recess'; data: import('../model/PlanData').FurnitureData };
