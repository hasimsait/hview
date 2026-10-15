import { createContext,useContext,useSyncExternalStore } from 'react';
import { ApplicationRuntime } from '../../application/ApplicationRuntime';

export const RuntimeContext = createContext<ApplicationRuntime | null>(null);
export function useRuntime(): ApplicationRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error('RuntimeContext is missing');
  return runtime;
}
export function useDocument() {
  const { editor } = useRuntime();
  useSyncExternalStore(editor.subscribe, editor.getRevision);
  return editor.getSnapshot();
}
export function useSelection() {
  const { editor } = useRuntime();
  return useSyncExternalStore(editor.selection.subscribe, editor.selection.getSnapshot);
}
