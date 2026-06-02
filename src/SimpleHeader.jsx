/**
 * Простая шапка без контекста (экран загрузки / ошибки).
 */
import { Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/', label: 'Главная' },
  { to: '/characters', label: 'Персонажи' },
  { to: '/team', label: 'Команда' },
  { to: '/results', label: 'Результаты' },
];

export function SimpleHeader() {
  const { pathname } = useLocation();

  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-genshin-gold">
          <span>⚔️</span> Genshin Calc
        </Link>
        <nav className="flex gap-1 sm:gap-4">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`rounded px-3 py-1.5 text-sm transition hover:bg-white/10 ${
                pathname === to || (to !== '/' && pathname.startsWith(to))
                  ? 'bg-white/15 text-genshin-gold'
                  : 'text-gray-200'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
