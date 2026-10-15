import { Column } from '../../domain/elements/Column';
import { Door,Opening,SlidingDoor } from '../../domain/elements/Opening';
import type { ColumnSide,RoomData,SurfaceFinishConfig,WallFrameStyle,WallSide } from '../../domain/model/PlanData';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import type { EditorCommand } from './EditorCommand';

export class SplitWall implements EditorCommand {
  readonly label = 'Split wall';
  readonly selectionRemap: ReadonlyMap<string, string>;
  constructor(private readonly id: string, private readonly distance: number) { this.selectionRemap = new Map([[id, `${id}_a`]]); }
  execute(document: PlanDocument): PlanDocument { return document.splitWall(this.id, this.distance).document; }
}
export class ApplyRoomFinish implements EditorCommand {
  readonly label = 'Finish room surfaces';
  constructor(private readonly id: string, private readonly finish: SurfaceFinishConfig) { }
  execute(document: PlanDocument): PlanDocument { return document.applyRoomFinish(this.id, this.finish); }
}
export class FinishWall implements EditorCommand {
  readonly label = 'Finish wall';
  constructor(private readonly id: string, private readonly finish: SurfaceFinishConfig, private readonly side: WallSide = 'both') { }
  execute(document: PlanDocument): PlanDocument { return document.replace(document.requireWall(this.id).withFinish(this.side, this.finish)); }
}
export class FinishColumn implements EditorCommand {
  readonly label = 'Finish column';
  constructor(private readonly id: string, private readonly finish: SurfaceFinishConfig, private readonly side: ColumnSide = 'all') { }
  execute(document: PlanDocument): PlanDocument {
    const column = document.require(this.id);
    if (!(column instanceof Column)) throw new Error('Expected a column');
    return document.replace(column.withFinish(this.side, this.finish));
  }
}
export class FrameWall implements EditorCommand {
  readonly label = 'Configure wall frame';
  constructor(private readonly id: string, private readonly style: WallFrameStyle, private readonly color: string) { }
  execute(document: PlanDocument): PlanDocument { return document.replace(document.requireWall(this.id).withFrame(this.style, this.color)); }
}
export class ChangeWallMaterial implements EditorCommand {
  readonly label = 'Change wall material';
  constructor(private readonly id: string, private readonly material: string) { }
  execute(document: PlanDocument): PlanDocument { return document.replace(document.requireWall(this.id).withMaterial(this.material)); }
}
export class RenameRoom implements EditorCommand {
  readonly label = 'Rename room';
  constructor(private readonly id: string, private readonly name: string) { }
  execute(document: PlanDocument): PlanDocument { return document.replace(document.requireRoom(this.id).renamed(this.name)); }
}
export class FinishFloor implements EditorCommand {
  readonly label = 'Finish floor';
  constructor(private readonly id: string, private readonly finish?: SurfaceFinishConfig) { }
  execute(document: PlanDocument): PlanDocument { return document.replace(document.requireRoom(this.id).withFloorFinish(this.finish)); }
}
export class ConfigureCeiling implements EditorCommand {
  readonly label = 'Configure ceiling';
  constructor(private readonly id: string, private readonly type: RoomData['ceilingType']) { }
  execute(document: PlanDocument): PlanDocument { return document.replace(document.requireRoom(this.id).withCeiling(this.type)); }
}
export class OpenDoor implements EditorCommand {
  readonly label = 'Open door';
  constructor(private readonly id: string, private readonly degrees: number) { }
  execute(document: PlanDocument): PlanDocument {
    const door = document.require(this.id);
    if (!(door instanceof Door || door instanceof SlidingDoor)) throw new Error('Expected a door');
    return document.replace(door.withOpenAngle(Math.max(0, Math.min(180, Math.round(this.degrees)))));
  }
}
export class FlipDoor implements EditorCommand {
  readonly label = 'Flip door';
  constructor(private readonly id: string, private readonly part: 'swing' | 'hinge') { }
  execute(document: PlanDocument): PlanDocument {
    const door = document.require(this.id);
    if (!(door instanceof Door)) throw new Error('Only hinged doors have swing and hinge settings');
    return document.replace(door.flipped(this.part));
  }
}
export class FinishOpening implements EditorCommand {
  readonly label = 'Finish opening';
  constructor(private readonly id: string, private readonly finish?: SurfaceFinishConfig) { }
  execute(document: PlanDocument): PlanDocument {
    const opening = document.require(this.id);
    if (!(opening instanceof Opening)) throw new Error('Expected an opening');
    return document.replace(opening.withFinish(this.finish));
  }
}

export class RotateDoor implements EditorCommand {
  readonly label = 'Rotate door';
  constructor(private readonly id: string, private readonly delta: number) { }
  execute(document: PlanDocument): PlanDocument {
    const door = document.require(this.id);
    if (!(door instanceof Door)) return document;
    return document.replace(this.delta === 180 ? door.flipped('swing') : door.withOpenAngle(Math.max(0, Math.min(180, (door.openAngle ?? 40) + this.delta))));
  }
}

export class SplitColumn implements EditorCommand {
  readonly label = 'Split column';
  readonly selectionRemap: ReadonlyMap<string, string>;
  constructor(private readonly id: string, private readonly distance: number) { this.selectionRemap = new Map([[id, `${id}_a`]]); }
  execute(document: PlanDocument): PlanDocument { return document.splitColumn(this.id, this.distance); }
}
