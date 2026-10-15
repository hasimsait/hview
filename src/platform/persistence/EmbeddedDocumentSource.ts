import { validateDocumentJson } from './JsonDocument';
export class EmbeddedDocumentSource {
  read(): string | null {
    if (typeof window === 'undefined') return null;
    const candidates: string[] = [];
    try {
      const raw = (window as any).__PLAN_DATA__;
      if (raw) candidates.push(typeof raw === 'string' ? raw : JSON.stringify(raw));
    } catch (err) {
      console.warn('[DocumentStorage] Could not serialize embedded plan:', err);
    }
    const script = typeof document !== 'undefined' ? document.getElementById('plan-data') : null;
    if (script?.textContent) candidates.push(script.textContent);
    for (const embedded of candidates) {
      try {
        validateDocumentJson(embedded);
        return embedded;
      } catch (err) {
        console.warn('[DocumentStorage] Could not read embedded plan:', err);
      }
    }
    return null;
  }
}
