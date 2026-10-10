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
            <Link to="/registrar-recurso" className={buttonClasses('primary')}>
              Registrar recurso
            </Link>
          </>
        )}
      </nav>
    </header>
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
