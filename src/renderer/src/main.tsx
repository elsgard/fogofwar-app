import './assets/main.css'
// Patch PixiJS to avoid `new Function()` / eval — required by Electron's CSP.
// Must be imported before any other pixi.js import.
import 'pixi.js/unsafe-eval'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
