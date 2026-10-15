import { validateDocumentJson } from './JsonDocument';
export class EmbeddedDocumentSource {
  read(): string | null {
    if (typeof window === 'undefined') return null;
    const candidates: string[] = [];
    // The script is already the serialized document. Prefer it to serializing
    // the bootstrap object and then parsing that copy again.
    const script = typeof document !== 'undefined' ? document.getElementById('plan-data') : null;
    if (script?.textContent) {
      try {
        validateDocumentJson(script.textContent);
        return script.textContent;
      } catch (err) { console.warn('[DocumentStorage] Could not read embedded plan:', err); }
    }
    try {
      const raw = window.__PLAN_DATA__;
      if (raw) candidates.push(typeof raw === 'string' ? raw : JSON.stringify(raw));
    } catch (err) {
      console.warn('[DocumentStorage] Could not serialize embedded plan:', err);
    }
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
