import { DocumentController } from '../../src/application/DocumentController';
import { EditorSession } from '../../src/application/EditorSession';
import type { IDocumentStorage } from '../../src/core/types/services';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';

export type TestEditor = EditorSession & { readonly documents: DocumentController; readonly codec: PlanCodec; readonly legacy: LegacyPlanWriter };
export function createEditor(storage: IDocumentStorage = {
  savePlan: async () => true, loadPlan: async () => '{}', resetToTemplate: async () => '{}', getSaveStatus: () => 'idle', onSaveStatusChange: () => () => { },
}, codec = new PlanCodec()): TestEditor {
  const editor = new EditorSession(codec.factory);
  return Object.assign(editor, { documents: new DocumentController(editor, codec, storage), codec, legacy: new LegacyPlanWriter() });
}
/** Assertions about legacy compatibility explicitly pass through the legacy adapter. */
export function legacyData(json: string): any {
  const value = JSON.parse(json);
  return value.schemaVersion ? JSON.parse(new LegacyPlanWriter().encode(new PlanCodec().decode(value))) : value;
}
