import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { useLang } from './lib/i18n';
import './styles.css';
import { DataProvider } from './state/DataProvider';

/** Remounts the screens when the language changes so every text is rebuilt in the new language. */
function LocalizedApp() {
  const lang = useLang();
  return <App key={lang} />;
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <HashRouter>
      <DataProvider>
        <LocalizedApp />
      </DataProvider>
    </HashRouter>
  </StrictMode>,
);
