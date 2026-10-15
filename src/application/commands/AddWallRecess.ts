import type { RecessOptions } from '../../domain/elements/WallRecess';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import type { EditorCommand } from './EditorCommand';

export type { RecessOptions } from '../../domain/elements/WallRecess';

export class AddWallRecess implements EditorCommand {
  readonly label = 'Add wall recess';
  constructor(readonly id: string, private readonly wallId: string, private readonly options: RecessOptions = {}) { }
  execute(document: PlanDocument): PlanDocument { return document.addWallRecess(this.id, this.wallId, this.options); }
}
