import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { YMInitializer } from 'react-yandex-metrika'; // 👈 новая строка
import App from './App';
import './index.css';
import { ErrorBoundary } from './ErrorBoundary';
import { initSentry } from './sentry';

void initSentry().catch((error) => {
  console.error('Sentry init error:', error);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Элемент #root не найден');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <YMInitializer          // 👈 новый блок
      accounts={[110095176]}
      options={{
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
        trackHash: true,
      }}
      version="2"
    />
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);