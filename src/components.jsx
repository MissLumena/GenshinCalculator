/**
 * V2 — общие UI-компоненты: шапка, аватары, карточки, графики.
 */
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { ELEMENT_COLORS, getCharacterIconUrls } from './mockData';
import { useAppState } from './context';

/* ─── Состояния загрузки и ошибки ─── */
export function LoadingState({ message = 'Загрузка...' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-12">
      <p className="text-lg text-genshin-gold">{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <p className="max-w-md text-red-300">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded bg-genshin-gold px-4 py-2 text-genshin-dark hover:opacity-90"
        >
          Повторить
        </button>
      )}
    </div>
  );
}

/* ─── Аватар персонажа (jmp.blue → enka.network fallback) ─── */
export function CharacterAvatar({ character, size = 'md', className = '' }) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const sizes = { xs: 'h-8 w-8', sm: 'h-10 w-10', md: 'h-14 w-14', lg: 'h-20 w-20', xl: 'h-24 w-24' };
  const sizeClass = sizes[size] || sizes.md;

  const urls = character ? getCharacterIconUrls(character) : [];
  const currentUrl = urls[urlIndex];

  useEffect(() => {
    setUrlIndex(0);
    setFailed(false);
  }, [character?.id]);

  const handleError = () => {
    if (urlIndex < urls.length - 1) {
      setUrlIndex((i) => i + 1);
    } else {
      setFailed(true);
    }
  };

  if (!character || failed || !currentUrl) {
    return (
      <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs text-gray-300 ${className}`}>
        {character?.nameRu?.[0] || '?'}
      </div>
    );
  }

  return (
    <img
      key={currentUrl}
      src={currentUrl}
      alt={character.nameRu || character.name}
      className={`${sizeClass} shrink-0 rounded-full border border-gray-600 bg-genshin-dark object-cover ${className}`}
      loading="lazy"
      onError={handleError}
    />
  );
}

/* ─── Навигационная шапка ─── */
const NAV_LINKS = [
  { to: '/', label: 'Главная' },
  { to: '/characters', label: 'Персонажи' },
  { to: '/team', label: 'Команда' },
  { to: '/results', label: 'Результаты' },
];

export function Header() {
  const { pathname } = useLocation();
  const {
    isAuthenticated,
    authLoading,
    session,
    signIn,
    signUp,
    signOut,
    actionLoading,
  } = useAppState();

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (authMode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      setAuthOpen(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message || 'Ошибка авторизации');
    }
  };

  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-genshin-gold">
          <span>⚔️</span> Genshin Calc
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
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
          {!authLoading && (
            isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-gray-400 sm:inline">
                  {session?.user?.email}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthOpen(true);
                  setAuthError(null);
                }}
                className="rounded px-2 py-1 text-xs text-genshin-gold hover:bg-white/10"
              >
                Войти
              </button>
            )
          )}
        </div>
      </div>

      {authOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="glass-modal w-full max-w-sm p-6">
            <h3 className="mb-4 text-lg font-semibold text-genshin-gold">
              {authMode === 'signin' ? 'Вход' : 'Регистрация'}
            </h3>
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm"
              />
              {authError && (
                <p className="text-sm text-red-300">{authError}</p>
              )}
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full rounded bg-genshin-gold py-2 font-medium text-genshin-dark hover:opacity-90 disabled:opacity-50"
              >
                {actionLoading ? 'Загрузка...' : authMode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="mt-3 w-full text-sm text-gray-400 hover:text-white"
            >
              {authMode === 'signin' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
            </button>
            <button
              type="button"
              onClick={() => setAuthOpen(false)}
              className="mt-2 w-full text-sm text-gray-500 hover:text-gray-300"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─── Модальное окно подтверждения ─── */
export function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="glass-modal w-full max-w-md p-6">
        <h3 className="mb-2 text-lg font-semibold text-genshin-gold">{title}</h3>
        <p className="mb-6 text-gray-300">{message}</p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded px-4 py-2 text-gray-300 hover:bg-white/10">
            Отмена
          </button>
          <button type="button" onClick={onConfirm} className="rounded bg-genshin-accent px-4 py-2 hover:opacity-90">
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Тултип с формулой расчёта ─── */
export function Tooltip({ text, formula, children }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="glass-modal absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 p-2 text-xs text-gray-200">
          <span className="block font-medium text-genshin-gold">{text}</span>
          {formula && <span className="mt-1 block font-mono text-gray-400">{formula}</span>}
        </span>
      )}
    </span>
  );
}

/* ─── Поле ввода с валидацией диапазона ─── */
export function InputField({ label, value, onChange, min, max, step = 1, suffix = '', tooltip }) {
  const inputRef = useRef(null);
  const [text, setText] = useState(() => (value == null ? '' : String(value)));

  useEffect(() => {
    if (inputRef.current === document.activeElement) return;
    setText(value == null ? '' : String(value));
  }, [value]);

  const commitValue = (raw) => {
    if (raw === '' || raw === '-') {
      setText('');
      return;
    }
    let v = parseFloat(raw);
    if (Number.isNaN(v)) return;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    setText(String(v));
    onChange(v);
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    setText(raw);
    if (raw === '' || raw === '-') return;
    const v = parseFloat(raw);
    if (Number.isNaN(v)) return;
    let clamped = v;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    onChange(clamped);
  };

  const handleBlur = () => {
    if (text === '' || text === '-') {
      if (min !== undefined) {
        setText(String(min));
        onChange(min);
      } else {
        setText('');
      }
      return;
    }
    commitValue(text);
  };

  const field = (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          onBlur={handleBlur}
          className="glass-input w-full px-3 py-2"
        />
        {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
      </div>
    </label>
  );

  if (tooltip) {
    return (
      <Tooltip text={tooltip.text} formula={tooltip.formula}>
        {field}
      </Tooltip>
    );
  }
  return field;
}

/* ─── Компактная карточка персонажа ─── */
export function CharacterCard({
  character,
  onClick,
  selected = false,
  disabled = false,
  compact = true,
}) {
  const elColor = ELEMENT_COLORS[character.element] || 'bg-gray-500';

  return (
    <article
      className={`glass-panel-sm border transition ${
        compact ? 'p-2' : 'p-4'
      } ${
        disabled
          ? 'cursor-not-allowed border-gray-800 opacity-40'
          : selected
            ? 'cursor-pointer border-genshin-gold shadow-md'
            : 'cursor-pointer border-gray-700 hover:border-genshin-gold/60 hover:shadow-md'
      }`}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={(e) => !disabled && e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-center gap-2">
        <CharacterAvatar character={character} size={compact ? 'sm' : 'md'} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-white">{character.nameRu}</h3>
          <p className="truncate text-xs text-gray-500">{character.name}</p>
          <div className="mt-1 flex items-center gap-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] text-white ${elColor}`}>{character.element}</span>
            <span className="text-[10px] text-genshin-gold">{'★'.repeat(character.rarity)}</span>
          </div>
        </div>
        {disabled && (
          <span className="shrink-0 text-[10px] text-gray-500">В команде</span>
        )}
      </div>
    </article>
  );
}

/* ─── Панель описания созвездий ─── */
export function ConstellationPanel({ character, descriptions }) {
  if (!character) return null;

  return (
    <div className="glass-panel border-genshin-gold/40 p-5">
      <div className="mb-4 flex items-center gap-4">
        <CharacterAvatar character={character} size="lg" />
        <div>
          <h2 className="text-xl font-bold text-genshin-gold">{character.nameRu}</h2>
          <p className="text-sm text-gray-400">{character.name} · {character.element} · {character.weapon}</p>
        </div>
      </div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Созвездия</h3>
      <ul className="space-y-2">
        {descriptions.map((desc, i) => (
          <li
            key={i}
            className="rounded border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-gray-200"
          >
            <span className="mr-2 font-bold text-genshin-gold">C{i}</span>
            {desc.replace(/^C\d+\s—\s*/, '')}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Кнопка действия ─── */
export function ActionButton({ children, onClick, variant = 'primary', className = '', disabled = false }) {
  const styles = {
    primary: 'bg-genshin-gold text-genshin-dark hover:opacity-90',
    secondary: 'border border-genshin-gold/50 text-genshin-gold hover:bg-genshin-gold/10',
    accent: 'bg-genshin-accent hover:opacity-90',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-5 py-2.5 font-medium transition disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ─── Bar-диаграмма ─── */
export function BarChart({ data, labelKey = 'name', valueKey = 'value' }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item[labelKey]}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{item[labelKey]}</span>
            <span className="text-genshin-gold">{item[valueKey].toLocaleString()}</span>
          </div>
          <div className="h-4 overflow-hidden rounded bg-slate-900/50">
            <div
              className="h-full rounded bg-gradient-to-r from-genshin-gold to-genshin-accent transition-all"
              style={{ width: `${(item[valueKey] / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Pie-диаграмма ─── */
export function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const colors = ['#d4a853', '#e94560', '#4ecca3', '#533483'];
  let cumulative = 0;
  const segments = data.map((d, i) => {
    const start = (cumulative / total) * 360;
    cumulative += d.value;
    const end = (cumulative / total) * 360;
    return `${colors[i % colors.length]} ${start}deg ${end}deg`;
  });

  return (
    <div className="flex items-center gap-6">
      <div
        className="h-36 w-36 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${segments.join(', ')})` }}
      />
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: colors[i % colors.length] }} />
            {d.name}: {Math.round((d.value / total) * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}
