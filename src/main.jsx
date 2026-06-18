const rootElement = document.getElementById('root');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showBootError(message, details = '') {
  if (!rootElement) return;
  rootElement.innerHTML = `
    <div style="padding:1.5rem;color:#fff;font-family:system-ui,sans-serif;max-width:720px">
      <h1 style="color:#fff;margin:0 0 1rem">Не удалось запустить приложение</h1>
      <p style="margin:0 0 0.75rem;line-height:1.5">${escapeHtml(message)}</p>
      ${details ? `<pre style="white-space:pre-wrap;background:rgba(0,0,0,0.45);padding:1rem;border-radius:12px;font-size:13px;overflow:auto">${escapeHtml(details)}</pre>` : ''}
      <p style="margin-top:1rem;opacity:0.9;line-height:1.5">
        Запустите в папке проекта: <code style="background:rgba(0,0,0,0.35);padding:2px 6px;border-radius:6px">npm run dev</code><br />
        Откройте адрес из терминала (например <code style="background:rgba(0,0,0,0.35);padding:2px 6px;border-radius:6px">http://localhost:5173</code>).<br />
        Не открывайте файл index.html напрямую.
      </p>
    </div>
  `;
}

window.addEventListener('error', (event) => {
  if (!rootElement?.querySelector('.boot-loader')) return;
  showBootError(
    event.message || 'Ошибка загрузки скрипта',
    event.filename ? `${event.filename}:${event.lineno}` : '',
  );
});

window.addEventListener('unhandledrejection', (event) => {
  if (!rootElement?.querySelector('.boot-loader')) return;
  const reason = event.reason;
  showBootError(
    reason?.message || String(reason),
    reason?.stack || '',
  );
});

import('./bootstrap.jsx').catch((error) => {
  showBootError(
    error?.message || String(error),
    error?.stack || '',
  );
  console.error(error);
});
