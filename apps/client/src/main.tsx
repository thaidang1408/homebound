import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { unlockAudio } from './audio/engine';
import './ui/design-system/global.css';

if (import.meta.env.DEV) void import('./devtools');

// Browsers only allow sound after a user gesture.
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
