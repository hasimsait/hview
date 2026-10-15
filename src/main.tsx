import { App } from '@ui/App';
import { RuntimeContext } from '@ui/context/RuntimeContext';
import '@ui/styles/index.css';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { ApplicationRuntime } from './application/ApplicationRuntime';

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

export const runtime = new ApplicationRuntime();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <RuntimeContext.Provider value={runtime}>
    <App />
  </RuntimeContext.Provider>
);
