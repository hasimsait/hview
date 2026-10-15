import type { PlanDocument } from '../domain/model/PlanDocument';

interface Memento { readonly label: string; readonly before: PlanDocument; readonly after: PlanDocument; }

export class EditHistory {
  private entries: Memento[] = [];
  private cursor = 0;
  constructor(private readonly limit = 100) { }
  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.entries.length; }
  record(label: string, before: PlanDocument, after: PlanDocument): void {
    if (before === after) return;
    this.entries.splice(this.cursor);
    this.entries.push({ label, before, after });
    if (this.entries.length > this.limit) this.entries.shift();
    this.cursor = this.entries.length;
  }
  undo(): PlanDocument | undefined { return this.canUndo ? this.entries[--this.cursor].before : undefined; }
  redo(): PlanDocument | undefined { return this.canRedo ? this.entries[this.cursor++].after : undefined; }
  clear(): void { this.entries = []; this.cursor = 0; }
}
