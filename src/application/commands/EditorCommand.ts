import type { PlanElementFactory } from '../../domain/factories/PlanElementFactory';
import type { PlanDocument } from '../../domain/model/PlanDocument';

export interface CommandContext { readonly factory: PlanElementFactory; }
export interface EditorCommand {
  readonly label: string;
  readonly selectionRemap?: ReadonlyMap<string, string>;
  execute(document: PlanDocument, context: CommandContext): PlanDocument;
}

export class CommandBatch implements EditorCommand {
  constructor(readonly label: string, private readonly commands: readonly EditorCommand[]) { }
  execute(document: PlanDocument, context: CommandContext): PlanDocument {
    return this.commands.reduce((next, command) => command.execute(next, context), document);
  }
}
