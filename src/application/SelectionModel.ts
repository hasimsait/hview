import type { PlanDocument } from '../domain/model/PlanDocument';

export type Selection = { readonly kind: 'wall' | 'column' | 'furniture' | 'opening' | 'room'; readonly id: string; readonly subtarget?: string } | null;

export class SelectionModel {
  private snapshot: Selection = null;
  private readonly listeners = new Set<() => void>();
  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  select(kind: NonNullable<Selection>['kind'], element: { readonly id: string } | null | undefined, subtarget?: string): void {
    this.set(element ? { kind, id: element.id, subtarget } : null);
  }
  set(selection: Selection): void {
    if (this.snapshot?.id === selection?.id && this.snapshot?.kind === selection?.kind && this.snapshot?.subtarget === selection?.subtarget) return;
    this.snapshot = selection ? Object.freeze({ ...selection }) : null;
    for (const listener of this.listeners) { try { listener(); } catch (error) { console.error('Selection subscriber failed', error); } }
  }
  reconcile(document: PlanDocument, remap?: ReadonlyMap<string, string>): void {
    if (!this.snapshot) return;
    const id = remap?.get(this.snapshot.id) ?? this.snapshot.id;
    this.set(document.get(id) ? { ...this.snapshot, id } : null);
  }
}
