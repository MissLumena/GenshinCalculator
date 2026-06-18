/**
 * Простая шапка без контекста (экран загрузки / ошибки).
 */
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Главная' },
  { to: '/characters', label: 'Персонажи' },
  { to: '/team', label: 'Команда' },
  { to: '/results', label: 'Результаты' },
];

function isNavActive(pathname, to) {
  return pathname === to || (to !== '/' && pathname.startsWith(to));
}

export function SimpleHeader() {
  const { pathname } = useLocation();

  return (
    <header className="glass-topnav !left-3">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3">
        <nav className="flex flex-wrap justify-center gap-1">
          {NAV_ITEMS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link-pill ${isNavActive(pathname, to) ? 'nav-link-pill-active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
