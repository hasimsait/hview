import { WindowOpening } from '../../domain/elements/Opening';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import { defaultWindowGeometry, validateWindowGeometry, windowPosition, type WindowGeometry } from '../../domain/model/WindowGeometry';
import type { EditorCommand } from './EditorCommand';

export class AddWindow implements EditorCommand {
  readonly label = 'Add window';
  constructor(readonly id: string, private readonly wallId: string, private readonly geometry?: WindowGeometry) { }
  execute(document: PlanDocument): PlanDocument {
    if (document.get(this.id)) throw new Error(`Duplicate element ID: ${this.id}`);
    const wall = document.requireWall(this.wallId), geometry = this.geometry ?? defaultWindowGeometry(wall);
    validateWindowGeometry(wall, geometry);
    const window = new WindowOpening({ ...geometry, id: this.id, wallId: wall.id, type: 'window', position: windowPosition(wall, geometry.distanceAlongWall), curtainState: 'visible' });
    return document.replace(wall.withOpenings([...wall.openings, window].sort((a, b) => a.distanceAlongWall - b.distanceAlongWall)));
  }
}
export class ConfigureWindowGeometry implements EditorCommand {
  readonly label = 'Edit window dimensions';
  constructor(private readonly id: string, private readonly geometry: WindowGeometry) { }
  execute(document: PlanDocument): PlanDocument {
    const window = document.require(this.id);
    if (!(window instanceof WindowOpening)) throw new Error('Expected a window.');
    return document.replace(window.withGeometry(this.geometry, document.requireWall(window.wallId)));
  }
}
