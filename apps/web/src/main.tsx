import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

const root = createRoot(container);
const params = new URLSearchParams(window.location.search);
const isDesignRoute =
  import.meta.env.DEV && window.location.pathname.replace(/\/$/, '') === '/design';

if (isDesignRoute) {
  // The gallery is dev-only and stays out of the production bundle.
  void import('./design/DesignGallery').then(({ DesignGallery }) => {
    root.render(
      <StrictMode>
        <DesignGallery screen={params.get('screen')} state={params.get('state')} />
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
