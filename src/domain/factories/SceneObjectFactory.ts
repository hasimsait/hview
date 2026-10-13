import { WallObject } from '../entities/WallObject';
import { ColumnObject } from '../entities/ColumnObject';
import { FurnitureObject } from '../entities/furniture/FurnitureObject';
import { BasinLowerFurniture } from '../entities/furniture/BasinLowerFurniture';
import { ShelvingFurniture } from '../entities/furniture/ShelvingFurniture';
import { LightFixtureFurniture } from '../entities/furniture/LightFixtureFurniture';
import { GenericFurniture } from '../entities/furniture/GenericFurniture';
import { WallEntity, ColumnEntity, FurnitureEntity } from '../../core/types/plan';

export class SceneObjectFactory {
  static createWall(entity: WallEntity): WallObject {
    const wall = new WallObject(entity.id);
    return wall.fromEntity(entity);
  }

  static createColumn(entity: ColumnEntity): ColumnObject {
    const col = new ColumnObject(entity.id, entity.name, entity.type);
    return col.fromEntity(entity);
  }

  static createFurniture(entity: FurnitureEntity): FurnitureObject {
    const key = (entity.assetKey || '').toLowerCase();

    if (key === 'basin_cabinet_lower' || key === 'lower_basin_cabinet' || key === 'basin_lower') {
      const basin = new BasinLowerFurniture(entity.id, entity.displayName || entity.name);
      return basin.fromEntity(entity);
    }

    if (key === 'open_shelving' || key === 'shelving' || key === 'shelf' || key === 'pencil_cabinet') {
      const shelving = new ShelvingFurniture(entity.id, entity.displayName || entity.name);
      return shelving.fromEntity(entity);
    }

    if (key === 'wall_spot' || key === 'sconce' || entity.category === 'fixture') {
      const light = new LightFixtureFurniture(entity.id, entity.displayName || entity.name, entity.assetKey);
      return light.fromEntity(entity);
    }

    const generic = new GenericFurniture(entity.id, entity.displayName || entity.name, entity.assetKey, entity.category);
    return generic.fromEntity(entity);
  }
}
