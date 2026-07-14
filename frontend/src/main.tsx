import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { GlobalDropUpload } from './components/GlobalDropUpload';
import { ToastViewport } from './components/ToastViewport';
import { applyStoredTheme } from './lib/themes';
import './index.css';
import './theme.css';
import './review-navigation.css';
import './transport-polish.css';
import './confirm-dialog.css';
import './waveform.css';
import './ux-redesign.css';

applyStoredTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <GlobalDropUpload />
    <ToastViewport />
  </StrictMode>
);
