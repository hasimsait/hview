import { useState } from 'react';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void | Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>;
};

export function useViewportFullscreen() {
  const [isViewportFullscreen, setIsViewportFullscreen] = useState(false);

  const toggleViewportFullscreen = async () => {
    const next = !isViewportFullscreen;
    setIsViewportFullscreen(next);
    const doc = document as FullscreenDocument;
    const root = doc.documentElement as FullscreenElement;

    // Only the logo changes toolbar visibility. Browser fullscreen exits and
    // Escape must leave it hidden, including on iPhone and offline documents.
    try {
      if (next) {
        const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
        await request?.call(root);
      } else if (doc.fullscreenElement === root || doc.webkitFullscreenElement === root) {
        const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
        await exit?.call(doc);
      }
    } catch {
      // The viewport layout works independently of native fullscreen support.
    }
  };

  return { isViewportFullscreen, toggleViewportFullscreen };
}
