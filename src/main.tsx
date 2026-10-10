/* ================================================================
   Discord Clone - Main Application with Zustand State Management
   ================================================================ */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from './zustand/store';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider>
      <App />
    </Provider>
  </React.StrictMode>
);