/**
 * V2 — общие UI-компоненты: шапка, аватары, карточки, графики.
 */
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ELEMENT_COLORS, getCharacterIconUrls, getCharacterSplashUrls, getCharacterConstellationPortraitUrls } from './mockData';
import {
  fetchCharacterConstellationData,
  getConstellationLevelIconUrl,
  getConstellationShapeUrl,
} from './services/constellationService';
import { useAppState } from './context';
import { validateDisplayName, formatDisplayName } from './lib/displayName';
import {
  formatCharacterChartLabel,
  getCharacterNameEn,
  getCharacterNameRu,
} from './lib/characterName';

/* ─── Подпись персонажа (RU + EN) ─── */
export function CharacterNameLabel({
  character,
  primaryClassName = 'font-medium text-white',
  secondaryClassName = 'text-xs text-white/60',
  layout = 'stack',
  showSecondary = true,
  className = '',
}) {
  if (!character) return null;

  const nameRu = getCharacterNameRu(character);
  const nameEn = getCharacterNameEn(character);
  const showEn = showSecondary && Boolean(nameEn);

  if (layout === 'inline') {
    return (
      <span className={className}>
        <span className={primaryClassName}>{nameRu}</span>
        {showEn && (
          <>
            {' '}
            <span className={secondaryClassName}>({nameEn})</span>
          </>
        )}
      </span>
    );
  }

  return (
    <div className={className}>
      <p className={primaryClassName}>{nameRu}</p>
      {showEn && <p className={secondaryClassName}>{nameEn}</p>}
    </div>
  );
}

/* ─── Состояния загрузки и ошибки ─── */
export function LoadingState({ message = 'Загрузка...' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-12">
      <p className="text-lg font-medium text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
        {message}
      </p>
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
          className="btn-pill-gold px-4 py-2"
        >
          Повторить
        </button>
      )}
    </div>
  );
}

export function PageBackLink({ to, label, className = '' }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 text-sm font-medium text-white transition hover:text-white/75 ${className}`}
    >
      <span className="text-base leading-none" aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
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
      <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/25 text-xs text-white/90 ${className}`}>
        {character?.nameRu?.[0] || '?'}
      </div>
    );
  }

  return (
    <img
      key={currentUrl}
      src={currentUrl}
      alt={`${getCharacterNameRu(character)} / ${getCharacterNameEn(character)}`}
      className={`${sizeClass} shrink-0 rounded-full border border-gray-600 bg-genshin-dark object-cover ${className}`}
      loading="lazy"
      onError={handleError}
    />
  );
}

/* ─── Модальное окно (портал в body — не ломается sticky/backdrop-blur шапки) ─── */
export function ModalOverlay({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose ? (e) => {
        if (e.target === e.currentTarget) onClose();
      } : undefined}
      role="presentation"
    >
      {children}
    </div>,
    document.body,
  );
}

/* ─── Иконки боковой панели ─── */
const NAV_ITEMS = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/characters', label: 'Персонажи', icon: 'characters' },
  { to: '/team', label: 'Команда', icon: 'team' },
  { to: '/results', label: 'Результаты', icon: 'results' },
];

function NavIcon({ name }) {
  const cls = 'h-5 w-5';
  switch (name) {
    case 'home':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
        </svg>
      );
    case 'characters':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" strokeLinecap="round" />
        </svg>
      );
    case 'team':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="9" cy="8" r="2.5" />
          <circle cx="16" cy="9" r="2" />
          <path d="M4 19c0-2.5 2.2-4.5 5-4.5M15 19c0-2 1.6-3.5 3.5-3.5" strokeLinecap="round" />
        </svg>
      );
    case 'results':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M5 19V9M12 19V5M19 19v-8" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function isNavActive(pathname, to) {
  return pathname === to || (to !== '/' && pathname.startsWith(to));
}

/* ─── Навигационная шапка ─── */
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
    profileDisplayName,
    updateDisplayName,
  } = useAppState();

  const [authOpen, setAuthOpen] = useState(false);
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [editName, setEditName] = useState('');
  const [authError, setAuthError] = useState(null);
  const [nameEditError, setNameEditError] = useState(null);

  const resetAuthForm = () => {
    setEmail('');
    setPassword('');
    setRegisterName('');
    setAuthError(null);
  };

  const openNameEdit = () => {
    setEditName(profileDisplayName || '');
    setNameEditError(null);
    setNameEditOpen(true);
  };

  const handleNameEditSubmit = async (e) => {
    e.preventDefault();
    setNameEditError(null);
    const nameError = validateDisplayName(editName);
    if (nameError) {
      setNameEditError(nameError);
      return;
    }
    try {
      await updateDisplayName(editName);
      setNameEditOpen(false);
    } catch (err) {
      setNameEditError(err.message || 'Ошибка обновления имени');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (authMode === 'signin') {
        await signIn(email, password);
      } else {
        const nameError = validateDisplayName(registerName);
        if (nameError) {
          setAuthError(nameError);
          return;
        }
        await signUp(email, password, registerName);
      }
      setAuthOpen(false);
      resetAuthForm();
    } catch (err) {
      setAuthError(err.message || 'Ошибка авторизации');
    }
  };

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthError(null);
    setAuthOpen(true);
  };

  return (
    <>
      <aside className="glass-rail" aria-label="Боковая навигация">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            title={label}
            className={`rail-link ${isNavActive(pathname, to) ? 'rail-link-active' : ''}`}
          >
            <NavIcon name={icon} />
          </Link>
        ))}
      </aside>

      <header className="glass-topnav">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <nav className="flex items-center gap-0.5 md:hidden" aria-label="Мобильная навигация">
            {NAV_ITEMS.map(({ to, icon, label }) => (
              <Link
                key={to}
                to={to}
                title={label}
                className={`rail-link !h-9 !w-9 ${isNavActive(pathname, to) ? 'rail-link-active' : ''}`}
              >
                <NavIcon name={icon} />
              </Link>
            ))}
          </nav>

          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex" aria-label="Основная навигация">
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

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {!authLoading && (
              isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={openNameEdit}
                    className="btn-pill-ghost max-w-[120px] truncate !px-4 !py-1.5 text-xs sm:max-w-[160px]"
                    title="Изменить имя"
                  >
                    {profileDisplayName || formatDisplayName(session?.user?.email?.split('@')[0])}
                  </button>
                  <button type="button" onClick={signOut} className="btn-pill-solid !px-4 !py-1.5 text-xs">
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openAuth('signin')}
                    className="btn-pill-ghost !px-4 !py-1.5 text-xs"
                  >
                    Вход
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuth('signup')}
                    className="btn-pill-solid !px-4 !py-1.5 text-xs"
                  >
                    Регистрация
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </header>

      <ModalOverlay open={authOpen} onClose={() => {
        setAuthOpen(false);
        resetAuthForm();
      }}
      >
        <div className="glass-modal w-full max-w-sm p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            {authMode === 'signin' ? 'Вход' : 'Регистрация'}
          </h3>
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            {authMode === 'signup' && (
              <input
                type="text"
                required
                maxLength={100}
                placeholder="Имя (отображается в результатах)"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm"
                autoComplete="nickname"
              />
            )}
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
              className="btn-pill-gold w-full disabled:opacity-50"
            >
              {actionLoading ? 'Загрузка...' : authMode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
              setAuthError(null);
              setRegisterName('');
            }}
            className="mt-3 w-full text-sm text-gray-400 hover:text-white"
          >
            {authMode === 'signin' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthOpen(false);
              resetAuthForm();
            }}
            className="mt-2 w-full text-sm text-gray-500 hover:text-gray-300"
          >
            Отмена
          </button>
        </div>
      </ModalOverlay>

      <ModalOverlay open={nameEditOpen} onClose={() => setNameEditOpen(false)}>
        <div className="glass-modal w-full max-w-sm p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Изменить имя</h3>
          <p className="mb-4 text-sm text-gray-400">
            Это имя отображается на вкладке «Результаты»
          </p>
          <form onSubmit={handleNameEditSubmit} className="space-y-3">
            <input
              type="text"
              required
              maxLength={100}
              placeholder="Ваше имя"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm"
              autoComplete="nickname"
            />
            {nameEditError && (
              <p className="text-sm text-red-300">{nameEditError}</p>
            )}
            <button
              type="submit"
              disabled={actionLoading}
              className="btn-pill-gold w-full disabled:opacity-50"
            >
              {actionLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setNameEditOpen(false)}
            className="mt-3 w-full text-sm text-gray-500 hover:text-gray-300"
          >
            Отмена
          </button>
        </div>
      </ModalOverlay>
    </>
  );
}

/* ─── Модальное окно подтверждения ─── */
export function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  return (
    <ModalOverlay open={open} onClose={onCancel}>
      <div className="glass-modal w-full max-w-md p-6">
        <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
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
    </ModalOverlay>
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
          <span className="block font-medium text-white">{text}</span>
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

/* ─── Карточка персонажа для витрины (главная) ─── */
export function CharacterShowcaseCard({ character, to, useSplashArt = false }) {
  const [urlIndex, setUrlIndex] = useState(0);
  const iconUrls = character ? getCharacterIconUrls(character) : [];
  const splashUrls = character ? getCharacterSplashUrls(character) : [];
  const urls = useSplashArt
    ? [...splashUrls, ...iconUrls]
    : iconUrls;
  const currentUrl = urls[urlIndex];

  const card = (
    <article className="showcase-card group">
      <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-white/10" />
      {currentUrl ? (
        <img
          src={currentUrl}
          alt={`${getCharacterNameRu(character)} / ${getCharacterNameEn(character)}`}
          className={`absolute inset-0 h-full w-full object-cover opacity-95 transition duration-500 group-hover:scale-105 ${
            useSplashArt ? 'object-[center_15%] scale-110' : 'scale-125 object-top group-hover:scale-[1.4]'
          }`}
          loading="lazy"
          onError={() => {
            if (urlIndex < urls.length - 1) setUrlIndex((i) => i + 1);
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-4xl text-white/30">
          {character?.nameRu?.[0]}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <CharacterNameLabel character={character} />
        <p className="mt-1 text-xs text-white/60">{character.element} · {'★'.repeat(character.rarity)}</p>
      </div>
    </article>
  );

  if (to) {
    return <Link to={to} className="block">{card}</Link>;
  }
  return card;
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
          <CharacterNameLabel
            character={character}
            primaryClassName="truncate text-sm font-medium text-white"
            secondaryClassName="truncate text-xs text-white/55"
          />
          <div className="mt-1 flex items-center gap-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] text-white ${elColor}`}>{character.element}</span>
            <span className="text-[10px] text-white">{'★'.repeat(character.rarity)}</span>
          </div>
        </div>
        {disabled && (
          <span className="shrink-0 text-[10px] text-gray-500">В команде</span>
        )}
      </div>
    </article>
  );
}

/* ─── Горизонтальный выбор персонажа (как в референсе) ─── */
function PickerAvatar({ character, selected, onClick }) {
  const [urlIndex, setUrlIndex] = useState(0);
  const urls = character ? getCharacterIconUrls(character) : [];
  const currentUrl = urls[urlIndex];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`character-picker-item ${selected ? 'character-picker-item-active' : ''}`}
      title={`${getCharacterNameRu(character)} / ${getCharacterNameEn(character)}`}
      aria-pressed={selected}
    >
      {currentUrl ? (
        <img
          src={currentUrl}
          alt=""
          className="character-picker-avatar"
          onError={() => {
            if (urlIndex < urls.length - 1) setUrlIndex((i) => i + 1);
          }}
        />
      ) : (
        <span className="character-picker-avatar flex items-center justify-center text-xs">
          {character.nameRu?.[0]}
        </span>
      )}
      <span className="character-picker-pointer" aria-hidden />
      <CharacterNameLabel
        character={character}
        primaryClassName="max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight text-white"
        secondaryClassName="max-w-[4.5rem] truncate text-center text-[9px] leading-tight text-white/55"
      />
    </button>
  );
}

export function CharacterPickerBar({ characters, selectedId, onSelect }) {
  const scrollRef = useRef(null);

  const scrollBy = (delta) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (!characters.length) return null;

  return (
    <div className="character-picker-bar">
      <button
        type="button"
        className="character-picker-arrow left-1"
        onClick={() => scrollBy(-160)}
        aria-label="Прокрутить влево"
      >
        ‹
      </button>
      <div ref={scrollRef} className="character-picker-scroll">
        {characters.map((character) => (
          <PickerAvatar
            key={character.id}
            character={character}
            selected={selectedId === character.id}
            onClick={() => onSelect(character.id)}
          />
        ))}
      </div>
      <button
        type="button"
        className="character-picker-arrow right-1"
        onClick={() => scrollBy(160)}
        aria-label="Прокрутить вправо"
      >
        ›
      </button>
    </div>
  );
}

function ConstellationPortrait({ character }) {
  const [portraitIndex, setPortraitIndex] = useState(0);

  useEffect(() => {
    setPortraitIndex(0);
  }, [character?.id]);

  const portraitUrls = useMemo(
    () => getCharacterConstellationPortraitUrls(character),
    [character],
  );

  return (
    <div className="constellation-character">
      {portraitUrls[portraitIndex] ? (
        <img
          src={portraitUrls[portraitIndex]}
          alt={`${getCharacterNameRu(character)} / ${getCharacterNameEn(character)}`}
          className="constellation-portrait-img"
          onError={() => {
            if (portraitIndex < portraitUrls.length - 1) {
              setPortraitIndex((index) => index + 1);
            }
          }}
        />
      ) : (
        <CharacterAvatar character={character} size="xl" className="!border-0 !bg-transparent" />
      )}
    </div>
  );
}

function ConstellationShapeArt({ shapeUrlCandidates = [], characterId }) {
  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
  }, [shapeUrlCandidates]);

  const currentUrl = shapeUrlCandidates[urlIndex];

  if (!currentUrl) return null;

  const shapeClassName = getConstellationShapeImgClassName(characterId);

  return (
    <img
      src={currentUrl}
      alt=""
      className={shapeClassName}
      onError={() => {
        if (urlIndex < shapeUrlCandidates.length - 1) {
          setUrlIndex((index) => index + 1);
        }
      }}
    />
  );
}

const BRIGHT_CONSTELLATION_SHAPE_IDS = new Set(['ororon']);

export function getConstellationShapeImgClassName(characterId) {
  if (BRIGHT_CONSTELLATION_SHAPE_IDS.has(characterId)) {
    return 'constellation-shape-img constellation-shape-img--bright';
  }
  return 'constellation-shape-img';
}

const HIGHLIGHT_TERMS = [
  'Elemental Burst',
  'Elemental Skill',
  'Normal Attack',
  'Charged Attack',
  'Plunging Attack',
  'CRIT Rate',
  'CRIT DMG',
  'Anemo DMG',
  'Pyro DMG',
  'Hydro DMG',
  'Electro DMG',
  'Cryo DMG',
  'Geo DMG',
  'Dendro DMG',
  'HP',
  'ATK',
  'Energy',
  'DMG',
  'Взрыв стихии',
  'Элементальный навык',
  'Элементальная реакция',
  'Обычная атака',
  'Заряженная атака',
  'Атака в падении',
  'шанс крит. попадания',
  'крит. урон',
  'Анемо',
  'Пиро',
  'Гидро',
  'Электро',
  'Крио',
  'Гео',
  'Дендро',
  'HP',
  'ATK',
  'Энергия',
  'урон',
  'Макс. уровень',
];

export function highlightConstellationText(text) {
  if (!text) return null;

  const pattern = new RegExp(`(${HIGHLIGHT_TERMS.join('|')})`, 'g');
  const parts = text.split(pattern);

  return parts.map((part, index) => (
    HIGHLIGHT_TERMS.includes(part)
      ? <span key={`${part}-${index}`} className="constellation-highlight">{part}</span>
      : part
  ));
}

/* ─── Панель созвездий (референс UI) ─── */
export function ConstellationPanel({
  character,
  activeLevel,
  onActiveLevelChange,
}) {
  const [internalLevel, setInternalLevel] = useState(1);
  const [items, setItems] = useState([]);
  const [constellationName, setConstellationName] = useState('');
  const [shapeUrlCandidates, setShapeUrlCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  const currentLevel = activeLevel ?? internalLevel;

  useEffect(() => {
    setInternalLevel(1);
  }, [character?.id]);

  useEffect(() => {
    if (!character) {
      setItems([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setUnavailable(false);

    fetchCharacterConstellationData(character)
      .then((data) => {
        if (cancelled) return;
        if (data.unavailable || !data.items?.length) {
          setUnavailable(true);
          setItems([]);
          setConstellationName('');
          setShapeUrlCandidates([]);
          return;
        }
        setItems(data.items);
        setConstellationName(data.constellationName);
        setShapeUrlCandidates(
          data.shapeUrlCandidates?.length
            ? data.shapeUrlCandidates
            : (data.shapeUrl ? [data.shapeUrl] : []),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message || 'Не удалось загрузить созвездия');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [character]);

  if (!character) return null;

  const activeItem = items.find((item) => item.level === currentLevel)
    || items.find((item) => item.level === 1)
    || items[0];

  const handleSelect = (level) => {
    if (onActiveLevelChange) {
      onActiveLevelChange(level);
    } else {
      setInternalLevel(level);
    }
  };

  const constellationNodes = items
    .filter((item) => item.level >= 1 && item.level <= 6)
    .sort((a, b) => a.level - b.level);

  return (
    <section className="constellation-panel" aria-label={`Созвездия — ${getCharacterNameRu(character)}`}>
      <div className="constellation-header">
        <span className="constellation-badge">Созвездие</span>
        {constellationName ? (
          <p className="constellation-subtitle">{constellationName}</p>
        ) : null}
      </div>

      {loading && (
        <p className="mb-4 text-center text-sm text-white/70">Загрузка созвездий...</p>
      )}
      {loadError && (
        <p className="mb-4 text-center text-sm text-red-200">{loadError}</p>
      )}
      {!loading && unavailable && (
        <p className="mb-4 text-center text-sm text-white/70">
          Данные созвездия для этого персонажа недоступны.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="constellation-body">
          <ConstellationPortrait character={character} />

          <div className="constellation-side">
            <div className="constellation-art-block">
              <div className="constellation-art-wrap" aria-hidden>
                <ConstellationShapeArt
                  shapeUrlCandidates={shapeUrlCandidates}
                  characterId={character.id}
                />
              </div>

              <div className="constellation-nodes" role="tablist" aria-label="Уровни созвездий">
                {constellationNodes.map((item) => {
                  const isActive = currentLevel === item.level;
                  const nodeIconUrl = item.iconUrl || getConstellationLevelIconUrl(character, item.level);

                  return (
                    <button
                      key={item.level}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`Созвездие ${item.level}`}
                      onClick={() => handleSelect(item.level)}
                      className={`constellation-node ${isActive ? 'constellation-node-active' : ''}`}
                    >
                      {nodeIconUrl ? (
                        <img src={nodeIconUrl} alt="" className="constellation-node-icon" />
                      ) : (
                        `C${item.level}`
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeItem && (
              <div className="constellation-detail">
                <h3 className="constellation-detail-title">
                  {currentLevel === 0
                    ? `${constellationName || activeItem.title}`
                    : `Созвездие ${currentLevel}: ${activeItem.title}`}
                </h3>
                <p className="constellation-detail-text">
                  {highlightConstellationText(activeItem.description)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── Кнопка действия ─── */
export function ActionButton({ children, onClick, variant = 'primary', className = '', disabled = false }) {
  const styles = {
    primary: 'btn-pill-gold disabled:opacity-40',
    secondary: 'btn-pill-ghost border-genshin-mint/50 text-genshin-mintbright hover:bg-genshin-mint/15',
    accent: 'btn-pill-solid bg-genshin-accent/90 hover:bg-genshin-accent',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`font-medium transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
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
            <span className="text-white">{item[valueKey].toLocaleString()}</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full border border-white/30 bg-white/20">
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
