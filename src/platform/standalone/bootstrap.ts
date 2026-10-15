import { gunzipSync } from 'fflate';
import { decodeBase64 } from '../../services/export/BinaryEncoding';
import type { PortableResources } from './PortableResources';

// This small decoder runs before the application bundle. No fetch, origin-bound
// storage, eval, DecompressionStream, or external script is needed on Safari 15.
function failed(error: unknown): void {
  console.error('[Portable HTML]', error);
  const status = document.getElementById('portable-status');
  if (!status) return;
  status.setAttribute('role', 'alert');
  status.textContent = 'This plan could not open. Reload this HTML to try again.';
  const retry = document.createElement('button');
  retry.textContent = 'Reload'; retry.onclick = () => location.reload();
  status.appendChild(retry);
}

function prepare(): void {
  const blocks = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const node of document.querySelectorAll<HTMLScriptElement>('script[data-hview-encoding="gzip-base64"]')) {
    blocks.set(node.id, decodeBase64(node.textContent!.trim()));
    node.remove();
  }
  const resources: PortableResources = {
    readText(id) {
      const bytes = blocks.get(id);
      return bytes ? new TextDecoder().decode(gunzipSync(bytes)) : undefined;
    },
  };
  window.__HVIEW_RESOURCES__ = resources;

  // Yield so the portable loading message can paint before parsing the editor.
  setTimeout(() => {
    const status = document.getElementById('portable-status');
    try {
      const id = blocks.has('editor-runtime') ? 'editor-runtime' : 'viewer-runtime';
      const original = document.getElementById(id);
      const source = resources.readText(id) ?? original?.textContent;
      if (!source?.trim()) throw new Error('Missing application bundle');
      original?.remove();
      const script = document.createElement('script');
      script.textContent = source;
      // Inline script exceptions are reported through window's error event.
      let failed = false;
      const onError = () => { failed = true; };
      window.addEventListener('error', onError);
      try { document.body.appendChild(script); } finally {
        script.remove(); window.removeEventListener('error', onError);
      }
      if (failed) throw new Error('Application initialization failed');
      status?.remove();
    } catch (error) {
      failed(error);
    }
  }, 0);
}

try { prepare(); } catch (error) { failed(error); }
