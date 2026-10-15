export interface PortableResources {
  readText(id: string): string | undefined;
}

declare global {
  interface Window { __HVIEW_RESOURCES__?: PortableResources; }
}

/** Packed documents retain compressed bytes for Reset and offline re-export. */
export function readEmbeddedText(id: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return (typeof window === 'undefined' ? undefined : window.__HVIEW_RESOURCES__?.readText(id))
    ?? document.getElementById(id)?.textContent ?? undefined;
}
