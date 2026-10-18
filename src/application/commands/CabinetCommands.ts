import type { CabinetLayout } from '../../domain/cabinet/CabinetLayout';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import type { EditorCommand } from './EditorCommand';
export class ConfigureCabinet implements EditorCommand {
  constructor(private readonly id: string, private readonly layout: CabinetLayout, readonly label = 'Edit cabinet layout') {}
  execute(document: PlanDocument): PlanDocument { return document.replace(document.requireFurniture(this.id).withCabinet(this.layout)); }
}
