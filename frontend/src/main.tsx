import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { GlobalDropUpload } from './components/GlobalDropUpload';
import { ShortcutHelp } from './components/ShortcutHelp';
import { ThemePicker } from './components/ThemePicker';
import { ToastViewport } from './components/ToastViewport';
import { applyStoredTheme } from './lib/themes';
import './index.css';
import './theme.css';
import './review-navigation.css';
import './transport-polish.css';

applyStoredTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <div className="header-tools-shell" aria-label="Display and help tools">
      <ThemePicker />
      <ShortcutHelp />
    </div>
    <GlobalDropUpload />
    <ToastViewport />
  </StrictMode>
);
