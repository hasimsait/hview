import { FurnitureEntity,SurfaceFinishConfig,WallEntity } from '@core/types/plan';
import { WallSide } from '@core/types/services';
import { FinishFurniture } from '../../../application/commands/FurnitureCommands';
import { FinishWall } from '../../../application/commands/StructuralCommands';
import type { EditorSession } from '../../../application/EditorSession';

export interface IWallTargetStrategy {
  id: string;
  label: string;
  title: string;
  wallSide?: WallSide;
  getFinish(wall: WallEntity, recess?: FurnitureEntity | null): SurfaceFinishConfig | undefined;
  applyFinish(
    editor: EditorSession,
    wall: WallEntity,
    finish: SurfaceFinishConfig,
    recess?: FurnitureEntity | null
  ): void;
  resetFinish(
    editor: EditorSession,
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

  applyFinish(editor: EditorSession, wall: WallEntity, finish: SurfaceFinishConfig): void {
    editor.execute(new FinishWall(wall.id, finish, 'A'));
  }

  resetFinish(editor: EditorSession, wall: WallEntity): void {
    editor.execute(new FinishWall(wall.id, DEFAULT_PLASTER_FINISH, 'A'));
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

  applyFinish(editor: EditorSession, wall: WallEntity, finish: SurfaceFinishConfig): void {
    editor.execute(new FinishWall(wall.id, finish, 'B'));
  }

  resetFinish(editor: EditorSession, wall: WallEntity): void {
    editor.execute(new FinishWall(wall.id, DEFAULT_PLASTER_FINISH, 'B'));
  }
}

export class EdgesTargetStrategy implements IWallTargetStrategy {
  readonly id = 'edges';
  readonly label = 'Opening returns / edges';
  readonly title = 'Thickness sides, jambs, and end returns';
  readonly wallSide: WallSide = 'edges';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishEdges || wall.finish;
  }

  applyFinish(editor: EditorSession, wall: WallEntity, finish: SurfaceFinishConfig): void {
    editor.execute(new FinishWall(wall.id, finish, 'edges'));
  }

  resetFinish(editor: EditorSession, wall: WallEntity): void {
    editor.execute(new FinishWall(wall.id, DEFAULT_PLASTER_FINISH, 'edges'));
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

  applyFinish(editor: EditorSession, wall: WallEntity, finish: SurfaceFinishConfig): void {
    editor.execute(new FinishWall(wall.id, finish, 'edge_start'));
  }

  resetFinish(editor: EditorSession, wall: WallEntity): void {
    editor.execute(new FinishWall(wall.id, DEFAULT_PLASTER_FINISH, 'edge_start'));
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

  applyFinish(editor: EditorSession, wall: WallEntity, finish: SurfaceFinishConfig): void {
    editor.execute(new FinishWall(wall.id, finish, 'edge_end'));
  }

  resetFinish(editor: EditorSession, wall: WallEntity): void {
    editor.execute(new FinishWall(wall.id, DEFAULT_PLASTER_FINISH, 'edge_end'));
  }
}

export class EdgeTopTargetStrategy implements IWallTargetStrategy {
  readonly id = 'edge_top';
  readonly label = 'Wall top edge';
  readonly title = 'Top horizontal sill of the wall';
  readonly wallSide: WallSide = 'edge_top';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishEdgeTop || wall.finishEdges || wall.finish;
  }

  applyFinish(editor: EditorSession, wall: WallEntity, finish: SurfaceFinishConfig): void {
    editor.execute(new FinishWall(wall.id, finish, 'edge_top'));
  }

  resetFinish(editor: EditorSession, wall: WallEntity): void {
    editor.execute(new FinishWall(wall.id, DEFAULT_PLASTER_FINISH, 'edge_top'));
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

  applyFinish(editor: EditorSession, wall: WallEntity, finish: SurfaceFinishConfig): void {
    editor.execute(new FinishWall(wall.id, finish, 'both'));
  }

  resetFinish(editor: EditorSession, wall: WallEntity): void {
    editor.execute(new FinishWall(wall.id, DEFAULT_PLASTER_FINISH, 'both'));
  }
}

export class RecessWallTargetStrategy implements IWallTargetStrategy {
  readonly id = 'recess_wall';
  readonly label = 'Recess Wall';
  readonly title = 'Recessed back wall face of the niche';

  getFinish(_wall: WallEntity, recess?: FurnitureEntity | null): SurfaceFinishConfig | undefined {
    if (!recess?.sectionFinishes) return undefined;
    return recess.sectionFinishes.recess_wall;
  }

  applyFinish(
    editor: EditorSession,
    _wall: WallEntity,
    finish: SurfaceFinishConfig,
    recess?: FurnitureEntity | null
  ): void {
    if (!recess) return;
    editor.execute(new FinishFurniture(recess.id, finish, 'recess_wall'));

  }

  resetFinish(
    editor: EditorSession,
    _wall: WallEntity,
    recess?: FurnitureEntity | null
  ): void {
    if (!recess) return;
    editor.execute(new FinishFurniture(recess.id, undefined, 'recess_wall'));
  }
}

export class RecessCornersTargetStrategy implements IWallTargetStrategy {
  readonly id = 'corners';
  readonly label = 'Recess Sides';
  readonly title = 'Inner 4 returns / jambs / shelf of the niche';

  getFinish(_wall: WallEntity, recess?: FurnitureEntity | null): SurfaceFinishConfig | undefined {
    if (!recess?.sectionFinishes) return undefined;
    return recess.sectionFinishes.sides;
  }

  applyFinish(
    editor: EditorSession,
    _wall: WallEntity,
    finish: SurfaceFinishConfig,
    recess?: FurnitureEntity | null
  ): void {
    if (!recess) return;
    editor.execute(new FinishFurniture(recess.id, finish, 'sides'));
  }

  resetFinish(
    editor: EditorSession,
    _wall: WallEntity,
    recess?: FurnitureEntity | null
  ): void {
    if (!recess) return;
    editor.execute(new FinishFurniture(recess.id, undefined, 'sides'));
  }
}

export class BaseboardTargetStrategy implements IWallTargetStrategy {
  readonly id = 'baseboard';
  readonly label = 'Skirting board (bottom)';
  readonly title = 'Bottom corner baseboard / skirting molding';
  readonly wallSide: WallSide = 'baseboard';

  getFinish(wall: WallEntity): SurfaceFinishConfig | undefined {
    return wall.finishBaseboard || wall.finishEdges || wall.finish;
  }

  applyFinish(editor: EditorSession, wall: WallEntity, finish: SurfaceFinishConfig): void {
    editor.execute(new FinishWall(wall.id, finish, 'baseboard'));
  }

  resetFinish(editor: EditorSession, wall: WallEntity): void {
    editor.execute(new FinishWall(wall.id, DEFAULT_PLASTER_FINISH, 'baseboard'));
  }
}

const recessSidesStrategy = new RecessCornersTargetStrategy();
const baseboardStrategy = new BaseboardTargetStrategy();
const sillStrategy: IWallTargetStrategy = {
  id: 'sill', label: 'Window sills', title: 'Horizontal sills below windows', wallSide: 'sill',
  getFinish: wall => wall.finishSill ?? wall.finishEdges ?? wall.finish,
  applyFinish: (editor, wall, finish) => { editor.execute(new FinishWall(wall.id, finish, 'sill')); },
  resetFinish: (editor, wall) => { editor.execute(new FinishWall(wall.id, DEFAULT_PLASTER_FINISH, 'sill')); },
};
const corniceStrategy: IWallTargetStrategy = {
  id: 'cornice', label: 'Top corner / cornice', title: 'Wall-to-wall ceiling cornice', wallSide: 'cornice',
  getFinish: wall => wall.cornice?.finish,
  applyFinish: (editor, wall, finish) => { editor.execute(new FinishWall(wall.id, finish, 'cornice')); },
  resetFinish: (editor, wall) => { editor.execute(new FinishWall(wall.id, { type: 'plaster', color: '#ffffff' }, 'cornice')); },
};

export const WALL_TARGET_STRATEGIES: Record<string, IWallTargetStrategy> = {
  A: new SideATargetStrategy(),
  B: new SideBTargetStrategy(),
  edge_start: new EdgeStartTargetStrategy(),
  edge_end: new EdgeEndTargetStrategy(),
  edge_top: new EdgeTopTargetStrategy(),
  sill: sillStrategy,
  cornice: corniceStrategy,
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
