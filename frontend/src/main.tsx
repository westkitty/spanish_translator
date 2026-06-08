import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemePicker } from './components/ThemePicker';
import { applyStoredTheme } from './lib/themes';
import './index.css';
import './theme.css';

applyStoredTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ThemePicker className="theme-picker-shell" />
  </StrictMode>
);
