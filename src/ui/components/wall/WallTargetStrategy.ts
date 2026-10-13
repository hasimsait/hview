import { WallEntity, FurnitureEntity, SurfaceFinishConfig } from '@core/types/plan';
import { IPlanManagerService, WallSide } from '@core/types/services';

export interface IWallTargetStrategy {
  id: string;
  label: string;
  title: string;
  wallSide?: WallSide;
  getFinish(wall: WallEntity, recess?: FurnitureEntity | null): SurfaceFinishConfig | undefined;
  applyFinish(
    planManager: IPlanManagerService,
    wall: WallEntity,
    finish: SurfaceFinishConfig,
    recess?: FurnitureEntity | null
  ): void;
  resetFinish(
    planManager: IPlanManagerService,
    wall: WallEntity,
    recess?: FurnitureEntity | null
  ): void;
}

const DEFAULT_PLASTER_FINISH: SurfaceFinishConfig = {
  type: 'plaster',
  variant: 'smooth',
  color: '#efede8',
  roughness: 0.85,
};

export class SideATargetStrategy implements IWallTargetStrategy {
  readonly id = 'A';
  readonly label = 'Side A';
  readonly title = 'Side A';
  readonly wallSide: WallSide = 'A';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishSideA || wall.finish;
  }

  applyFinish(planManager: IPlanManagerService, wall: WallEntity, finish: SurfaceFinishConfig): void {
    planManager.setWallFinish(wall.id, finish, 'A');
  }

  resetFinish(planManager: IPlanManagerService, wall: WallEntity): void {
    planManager.setWallFinish(wall.id, DEFAULT_PLASTER_FINISH, 'A');
  }
}

export class SideBTargetStrategy implements IWallTargetStrategy {
  readonly id = 'B';
  readonly label = 'Side B';
  readonly title = 'Side B';
  readonly wallSide: WallSide = 'B';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishSideB || wall.finish;
  }

  applyFinish(planManager: IPlanManagerService, wall: WallEntity, finish: SurfaceFinishConfig): void {
    planManager.setWallFinish(wall.id, finish, 'B');
  }

  resetFinish(planManager: IPlanManagerService, wall: WallEntity): void {
    planManager.setWallFinish(wall.id, DEFAULT_PLASTER_FINISH, 'B');
  }
}

export class EdgesTargetStrategy implements IWallTargetStrategy {
  readonly id = 'edges';
  readonly label = 'Sides / Edges';
  readonly title = 'Thickness sides, jambs, and end returns';
  readonly wallSide: WallSide = 'edges';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishEdges || wall.finish;
  }

  applyFinish(planManager: IPlanManagerService, wall: WallEntity, finish: SurfaceFinishConfig): void {
    planManager.setWallFinish(wall.id, finish, 'edges');
  }

  resetFinish(planManager: IPlanManagerService, wall: WallEntity): void {
    planManager.setWallFinish(wall.id, DEFAULT_PLASTER_FINISH, 'edges');
  }
}

export class EdgeStartTargetStrategy implements IWallTargetStrategy {
  readonly id = 'edge_start';
  readonly label = 'Start End Cap (p1)';
  readonly title = 'Start end cap facing Room 1 / exterior at p1';
  readonly wallSide: WallSide = 'edge_start';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishEdgeStart || wall.finishEdges || wall.finish;
  }

  applyFinish(planManager: IPlanManagerService, wall: WallEntity, finish: SurfaceFinishConfig): void {
    planManager.setWallFinish(wall.id, finish, 'edge_start');
  }

  resetFinish(planManager: IPlanManagerService, wall: WallEntity): void {
    planManager.setWallFinish(wall.id, DEFAULT_PLASTER_FINISH, 'edge_start');
  }
}

export class EdgeEndTargetStrategy implements IWallTargetStrategy {
  readonly id = 'edge_end';
  readonly label = 'End End Cap (p2)';
  readonly title = 'End end cap facing Room 2 / exterior at p2';
  readonly wallSide: WallSide = 'edge_end';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishEdgeEnd || wall.finishEdges || wall.finish;
  }

  applyFinish(planManager: IPlanManagerService, wall: WallEntity, finish: SurfaceFinishConfig): void {
    planManager.setWallFinish(wall.id, finish, 'edge_end');
  }

  resetFinish(planManager: IPlanManagerService, wall: WallEntity): void {
    planManager.setWallFinish(wall.id, DEFAULT_PLASTER_FINISH, 'edge_end');
  }
}

export class EdgeTopTargetStrategy implements IWallTargetStrategy {
  readonly id = 'edge_top';
  readonly label = 'Top Sill';
  readonly title = 'Top horizontal sill of the wall';
  readonly wallSide: WallSide = 'edge_top';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishEdgeTop || wall.finishEdges || wall.finish;
  }

  applyFinish(planManager: IPlanManagerService, wall: WallEntity, finish: SurfaceFinishConfig): void {
    planManager.setWallFinish(wall.id, finish, 'edge_top');
  }

  resetFinish(planManager: IPlanManagerService, wall: WallEntity): void {
    planManager.setWallFinish(wall.id, DEFAULT_PLASTER_FINISH, 'edge_top');
  }
}

export class BothSidesTargetStrategy implements IWallTargetStrategy {
  readonly id = 'both';
  readonly label = 'Both Sides';
  readonly title = 'Apply finish to all faces of the wall';
  readonly wallSide: WallSide = 'both';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishSideA || wall.finishSideB || wall.finish;
  }

  applyFinish(planManager: IPlanManagerService, wall: WallEntity, finish: SurfaceFinishConfig): void {
    planManager.setWallFinish(wall.id, finish, 'both');
  }

  resetFinish(planManager: IPlanManagerService, wall: WallEntity): void {
    planManager.setWallFinish(wall.id, DEFAULT_PLASTER_FINISH, 'both');
  }
}

export class RecessWallTargetStrategy implements IWallTargetStrategy {
  readonly id = 'recess_wall';
  readonly label = 'Recess Wall';
  readonly title = 'Recessed back wall face of the niche';

  getFinish(_wall: WallEntity, recess?: FurnitureEntity | null): SurfaceFinishConfig | undefined {
    if (!recess?.sectionFinishes) return undefined;
    return (
      recess.sectionFinishes['recess_wall'] ||
      recess.sectionFinishes['girinti_wall'] ||
      recess.sectionFinishes['Recess Wall'] ||
      recess.sectionFinishes['Girinti Wall']
    );
  }

  applyFinish(
    planManager: IPlanManagerService,
    _wall: WallEntity,
    finish: SurfaceFinishConfig,
    recess?: FurnitureEntity | null
  ): void {
    if (!recess) return;
    planManager.setFurnitureSectionFinish(recess.id, 'recess_wall', finish);
    if (recess.sectionFinishes?.['girinti_wall']) {
      planManager.setFurnitureSectionFinish(recess.id, 'girinti_wall', finish);
    }
  }

  resetFinish(
    planManager: IPlanManagerService,
    _wall: WallEntity,
    recess?: FurnitureEntity | null
  ): void {
    if (!recess) return;
    planManager.setFurnitureSectionFinish(recess.id, 'recess_wall', undefined);
    planManager.setFurnitureSectionFinish(recess.id, 'girinti_wall', undefined);
  }
}

export class RecessCornersTargetStrategy implements IWallTargetStrategy {
  readonly id = 'corners';
  readonly label = 'Recess Sides';
  readonly title = 'Inner 4 returns / jambs / shelf of the niche';

  getFinish(_wall: WallEntity, recess?: FurnitureEntity | null): SurfaceFinishConfig | undefined {
    if (!recess?.sectionFinishes) return undefined;
    return (
      recess.sectionFinishes['sides'] ||
      recess.sectionFinishes['Sides'] ||
      recess.sectionFinishes['corners'] ||
      recess.sectionFinishes['Corners'] ||
      recess.sectionFinishes['recess_sides']
    );
  }

  applyFinish(
    planManager: IPlanManagerService,
    _wall: WallEntity,
    finish: SurfaceFinishConfig,
    recess?: FurnitureEntity | null
  ): void {
    if (!recess) return;
    planManager.setFurnitureSectionFinish(recess.id, 'sides', finish);
    planManager.setFurnitureSectionFinish(recess.id, 'corners', finish);
  }

  resetFinish(
    planManager: IPlanManagerService,
    _wall: WallEntity,
    recess?: FurnitureEntity | null
  ): void {
    if (!recess) return;
    planManager.setFurnitureSectionFinish(recess.id, 'sides', undefined);
    planManager.setFurnitureSectionFinish(recess.id, 'corners', undefined);
  }
}

export class BaseboardTargetStrategy implements IWallTargetStrategy {
  readonly id = 'baseboard';
  readonly label = 'Baseboard (Bottom)';
  readonly title = 'Bottom corner baseboard / skirting molding';
  readonly wallSide: WallSide = 'baseboard';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishBaseboard || wall.finishEdges || wall.finish;
  }

  applyFinish(planManager: IPlanManagerService, wall: WallEntity, finish: SurfaceFinishConfig): void {
    planManager.setWallFinish(wall.id, finish, 'baseboard');
  }

  resetFinish(planManager: IPlanManagerService, wall: WallEntity): void {
    planManager.setWallFinish(wall.id, DEFAULT_PLASTER_FINISH, 'baseboard');
  }
}

const recessSidesStrategy = new RecessCornersTargetStrategy();
const baseboardStrategy = new BaseboardTargetStrategy();

export const WALL_TARGET_STRATEGIES: Record<string, IWallTargetStrategy> = {
  A: new SideATargetStrategy(),
  B: new SideBTargetStrategy(),
  edge_start: new EdgeStartTargetStrategy(),
  edge_end: new EdgeEndTargetStrategy(),
  edge_top: new EdgeTopTargetStrategy(),
  baseboard: baseboardStrategy,
  edge_bottom: baseboardStrategy,
  edges: new EdgesTargetStrategy(),
  both: new BothSidesTargetStrategy(),
  recess_wall: new RecessWallTargetStrategy(),
  corners: recessSidesStrategy,
  sides: recessSidesStrategy,
};

export function getWallTargetStrategy(targetId: string): IWallTargetStrategy {
  return WALL_TARGET_STRATEGIES[targetId] || WALL_TARGET_STRATEGIES.A;
}
