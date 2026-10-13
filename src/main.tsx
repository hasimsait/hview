import React from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { DIProvider } from '@ui/context/DIContext';
import { App } from '@ui/App';
import '@ui/styles/index.css';

// Intercept texture URLs with offline embedded base64 textures if available
THREE.DefaultLoadingManager.setURLModifier((url: string) => {
  if (typeof window !== 'undefined' && (window as any).__EMBEDDED_TEXTURES__) {
    const map = (window as any).__EMBEDDED_TEXTURES__ as Record<string, string>;
    if (map[url]) return map[url];
    const normUrl = url.startsWith('/') ? url : `/${url}`;
    if (map[normUrl]) return map[normUrl];
    const filename = url.split('/').pop()?.split('?')[0];
    if (filename) {
      for (const key in map) {
        if (key.endsWith('/' + filename) || key === filename) {
          return map[key];
        }
      }
    }
  }
  return url;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DIProvider>
      <App />
    </DIProvider>
  </React.StrictMode>
);
