import { PlanElementFactory } from '../domain/factories/PlanElementFactory';
import { PlanDocument } from '../domain/model/PlanDocument';
import { EditHistory } from './EditHistory';
import { SelectionModel } from './SelectionModel';
import type { EditorCommand } from './commands/EditorCommand';

export interface DocumentChange {
  readonly document: PlanDocument;
  readonly previous: PlanDocument | null;
  readonly added: readonly string[];
  readonly updated: readonly string[];
  readonly removed: readonly string[];
  readonly label: string;
}

export class EditorSession {
  private document: PlanDocument | null = null;
  private savedDocument: PlanDocument | null = null;
  private loadGeneration = 0;
  private revision = 0;
  private readonly listeners = new Set<(change: DocumentChange) => void>();
  readonly history = new EditHistory();
  readonly selection = new SelectionModel();

  constructor(readonly factory = new PlanElementFactory()) { }
  readonly getSnapshot = () => this.document;
  readonly subscribe = (listener: (change: DocumentChange) => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get isDirty(): boolean { return this.document !== this.savedDocument; }
  get generation(): number { return this.loadGeneration; }
  readonly getRevision = () => this.revision;
  getDocument(): PlanDocument { if (!this.document) throw new Error('No plan loaded'); return this.document; }

  load(document: PlanDocument): void {
    this.loadGeneration++;
    this.history.clear(); this.savedDocument = document; this.selection.set(null);
    this.publish(document, 'Load document');
  }
  markSaved(document: PlanDocument, generation = this.loadGeneration): void {
    if (generation !== this.loadGeneration) return;
    this.savedDocument = document;
    this.publish(this.getDocument(), 'Save document');
  }
  execute(command: EditorCommand): void {
    const before = this.getDocument();
    const after = command.execute(before, { factory: this.factory });
    if (before === after) return;
    this.history.record(command.label, before, after);
    this.publish(after, command.label);
    this.selection.reconcile(after, command.selectionRemap);
  }
  undo(): void { const document = this.history.undo(); if (document) { this.selection.reconcile(document); this.publish(document, 'Undo'); } }
  redo(): void { const document = this.history.redo(); if (document) { this.selection.reconcile(document); this.publish(document, 'Redo'); } }

  private publish(document: PlanDocument, label: string): void {
    const previous = this.document;
    this.document = document;
    this.revision++;
    const old = new Map(previous?.allElements.map(element => [element.id, element]) ?? []);
    const current = new Map(document.allElements.map(element => [element.id, element]));
    const change: DocumentChange = Object.freeze({
      document, previous, label,
      added: Object.freeze([...current.keys()].filter(id => !old.has(id))),
      updated: Object.freeze([...current.keys()].filter(id => old.has(id) && old.get(id) !== current.get(id))),
      removed: Object.freeze([...old.keys()].filter(id => !current.has(id))),
    });
    for (const listener of this.listeners) {
      try { listener(change); } catch (error) { console.error('Document subscriber failed', error); }
    }
  }
}
