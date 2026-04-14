import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Previne comportamento indesejado de alteração de valores de inputs do tipo number pelo scroll do mouse
document.addEventListener('wheel', (event) => {
  if (document.activeElement && 
      document.activeElement.tagName === 'INPUT' && 
      (document.activeElement as HTMLInputElement).type === 'number') {
    (document.activeElement as HTMLElement).blur();
  }
}, { passive: false });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)