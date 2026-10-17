import { Column } from '../../domain/elements/Column';
import { Door,Opening,SlidingDoor,WindowOpening } from '../../domain/elements/Opening';
import type { ColumnSide,CurtainState,RoomData,SurfaceFinishConfig,WallFrameStyle,WallSide } from '../../domain/model/PlanData';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import type { EditorCommand } from './EditorCommand';
import type { WindowDressingConfig } from '../../domain/model/WindowDressing';
import { roomCeilingMaximum } from '../../domain/model/Ceiling';
import { defaultWallCornice, type WallCorniceConfig } from '../../domain/model/WallCornice';
import type { BalconyRailingConfig } from '../../domain/model/BalconyRailing';

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
export class ConfigureWallCornice implements EditorCommand {
  readonly label = 'Configure wall cornice';
  constructor(private readonly id: string, private readonly cornice: WallCorniceConfig) { }
  execute(document: PlanDocument): PlanDocument { return document.replace(document.requireWall(this.id).withCornice(this.cornice)); }
}
export class SetWallSkirting implements EditorCommand {
  readonly label = 'Configure skirting boards';
  constructor(private readonly id: string, private readonly enabled: boolean) { }
  execute(document: PlanDocument): PlanDocument {
    const wall = document.requireWall(this.id);
    return document.replace(wall.withBaseboard(this.enabled ? wall.finishBaseboard ?? { type: 'paint', color: '#f3f1ea' } : undefined));
  }
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
export class ConfigureBalconyRailing implements EditorCommand {
  readonly label = 'Configure balcony railing';
  constructor(private readonly id: string, private readonly config?: BalconyRailingConfig) { }
  execute(document: PlanDocument): PlanDocument { return document.replace(document.requireRoom(this.id).withRailing(this.config)); }
}
export class SetCeilingHeight implements EditorCommand {
  readonly label = 'Set ceiling height';
  constructor(private readonly id: string, private readonly height?: number) { }
  execute(document: PlanDocument): PlanDocument {
    const room = document.requireRoom(this.id);
    if (this.height !== undefined && this.height > roomCeilingMaximum(room, document.totalHeight)) throw new Error('Ceiling height cannot exceed the shared maximum');
    return document.replace(room.withCeilingHeight(this.height));
  }
}
export class OpenDoor implements EditorCommand {
  readonly label = 'Open door';
  constructor(private readonly id: string, private readonly degrees: number) { }
  execute(document: PlanDocument): PlanDocument {
    const door = document.require(this.id);
    if (!(door instanceof Door || door instanceof SlidingDoor)) throw new Error('Expected a door');
    return document.replace(door.withOpenAngle(this.degrees));
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

export class ColorOpeningFrame implements EditorCommand {
  readonly label = 'Color opening frame';
  constructor(private readonly id: string, private readonly color?: string) { }
  execute(document: PlanDocument): PlanDocument {
    const opening = document.require(this.id);
    if (!(opening instanceof Opening)) throw new Error('Expected an opening');
    return document.replace(opening.withFrameColor(this.color));
  }
}

export class SetWindowCurtains implements EditorCommand {
  readonly label = 'Configure window curtains';
  constructor(private readonly id: string, private readonly state: CurtainState) { }
  execute(document: PlanDocument): PlanDocument {
    const window = document.require(this.id);
    if (!(window instanceof WindowOpening)) throw new Error('Expected a window');
    return document.replace(window.withCurtainState(this.state));
  }
}
export class ConfigureWindowDressing implements EditorCommand {
  readonly label = 'Configure window dressing';
  constructor(private readonly id: string, private readonly config?: WindowDressingConfig) { }
  execute(document: PlanDocument): PlanDocument {
    const window = document.require(this.id);
    if (!(window instanceof WindowOpening)) throw new Error('Expected a window');
    return document.replace(window.withWindowDressing(this.config));
  }
}

export class SetWindowPelmet implements EditorCommand {
  readonly label = 'Configure ceiling cornice';
  constructor(private readonly id: string, private readonly state: CurtainState) { }
  execute(document: PlanDocument): PlanDocument {
    const window = document.require(this.id);
    if (!(window instanceof WindowOpening)) throw new Error('Expected a window');
    const wall = document.requireWall(window.wallId), cornice = wall.cornice ?? defaultWallCornice(true);
    return document.replace(wall.withCornice({ ...cornice, profile: this.state === 'removed' ? 'none' : cornice.profile === 'none' ? 'cove' : cornice.profile, hidden: this.state === 'hidden' }));
  }
}

export class RotateDoor implements EditorCommand {
  readonly label = 'Rotate door';
  constructor(private readonly id: string, private readonly delta: number) { }
  execute(document: PlanDocument): PlanDocument {
    const door = document.require(this.id);
    if (!(door instanceof Door)) return document;
    return document.replace(door.rotatedBy(this.delta));
  }
}

export class SplitColumn implements EditorCommand {
  readonly label = 'Split column';
  readonly selectionRemap: ReadonlyMap<string, string>;
  constructor(private readonly id: string, private readonly distance: number) { this.selectionRemap = new Map([[id, `${id}_a`]]); }
  execute(document: PlanDocument): PlanDocument { return document.splitColumn(this.id, this.distance); }
}
