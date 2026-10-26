import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router'

import { buttonClasses } from '../components/ui/button.js'
import { SESSION_STATUS } from '../session/SessionContext.js'
import { useLogout } from '../session/useLogout.js'
import { useSession } from '../session/useSession.js'

/** Cabecera de todo el sitio: la usan la página de entrada y AppLayout. */
export default function SiteHeader() {
  const { status, account } = useSession()
  const { loggingOut, logoutFailed, handleLogout } = useLogout()
  // Mientras no se sabe si hay sesión no se ofrece crear cuenta ni iniciarla,
  // para no enseñárselo a quien ya la tiene.
  const signedOut = status !== SESSION_STATUS.LOADING && account === null

  return (
    <header className="relative mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <Link to="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-content">
        <Logo />
        NodoAula
      </Link>
      <nav aria-label="Principal" className="flex items-center gap-3 text-sm whitespace-nowrap text-content-muted sm:gap-5">
        <NavLink
          to="/catalogo"
          className={({ isActive }) => `hidden sm:block ${isActive ? 'text-content' : 'hover:text-content'}`}
        >
          Catálogo
        </NavLink>
        {signedOut && (
          <>
            <Link to="/iniciar-sesion" className="hover:text-content">
              Iniciar sesión
            </Link>
            <Link to="/registro" className={buttonClasses('primary')}>
              Crear cuenta
            </Link>
          </>
        )}
        {account !== null && (
          <>
            {logoutFailed && (
              <span className="text-red-400" role="alert">
                No se pudo cerrar la sesión.
              </span>
            )}
            <span className="hidden max-w-56 truncate md:block" title={account.email}>
              {account.email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="hover:text-content disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
            <ContributeMenu />
          </>
        )}
      </nav>
    </header>
  )
}

const CONTRIBUTIONS = [
  { to: '/registrar-recurso', label: 'Agregar un video', detail: 'Pega el enlace; los datos se completan desde YouTube.' },
  { to: '/subir-apunte', label: 'Subir un apunte', detail: 'Un PDF de hasta 20 MB.' },
]

/**
 * «Aportar» abre las dos formas de aportar. Es un desplegable de enlaces y no
 * un menú de aplicación: un botón con aria-expanded y una lista de enlaces
 * que se recorre con Tab. Se cierra con Escape, con un clic fuera o al elegir.
 */
function ContributeMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const buttonRef = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event) => {
      if (!containerRef.current.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current.focus()
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={buttonClasses('primary')}
      >
        Aportar
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="absolute top-[calc(100%+0.625rem)] right-0 z-40 flex w-[min(19rem,calc(100vw-2rem))] flex-col gap-0.5 rounded-2xl border border-border-strong bg-surface-raised p-1.5 whitespace-normal shadow-[0_22px_48px_-16px_rgb(0_0_0/0.7)]"
      >
        {CONTRIBUTIONS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `flex flex-col gap-0.5 rounded-xl px-3 py-2.5 hover:bg-surface-hover ${isActive ? 'bg-accent/10' : ''}`}
            >
              <span className="text-sm font-medium text-content">{item.label}</span>
              <span className="text-label text-content-muted">{item.detail}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-6">
      <path d="M5 5 19 12 5 19" className="stroke-border-strong" strokeWidth="2" />
      <circle cx="5" cy="5" r="3.5" className="fill-content" />
      <circle cx="5" cy="19" r="3.5" className="fill-content" />
      <circle cx="19" cy="12" r="4.5" className="fill-accent" />
    </svg>
  )
}
