import { App } from '@ui/App';
import { RuntimeContext } from '@ui/context/RuntimeContext';
import '@ui/styles/index.css';
import ReactDOM from 'react-dom/client';
import { ApplicationRuntime } from './application/ApplicationRuntime';
import { installEmbeddedTextureUrlModifier } from './engine/materials/TextureSource';

installEmbeddedTextureUrlModifier();

export const runtime = new ApplicationRuntime();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <RuntimeContext.Provider value={runtime}>
    <App />
  </RuntimeContext.Provider>
);
