import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'

import { SESSION_STATUS } from '../session/SessionContext.js'
import { useSession } from '../session/useSession.js'

function navLinkClass({ isActive }) {
  return isActive ? 'font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900'
}

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            NodoAula
          </Link>
          <SessionNav />
        </nav>
      </header>

      <Outlet />
    </div>
  )
}

function SessionNav() {
  const { status, account, logout } = useSession()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)

  // Mientras no se sabe si hay sesión no se muestra ni una opción ni la otra,
  // para no enseñar "Iniciar sesión" a quien ya la tiene.
  if (status === SESSION_STATUS.LOADING) return null

  if (account === null) {
    return (
      <div className="flex gap-4 text-sm">
        <NavLink to="/iniciar-sesion" className={navLinkClass}>
          Iniciar sesión
        </NavLink>
        <NavLink to="/registro" className={navLinkClass}>
          Crear cuenta
        </NavLink>
      </div>
    )
  }

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)
    setLogoutFailed(false)
    try {
      await logout()
    } catch (error) {
      // Sin respuesta del servidor no se sabe si la sesión se cerró; se deja
      // como estaba para que el usuario pueda reintentar.
      console.error('No se pudo cerrar la sesión', error)
      setLogoutFailed(true)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-4 text-sm">
      {logoutFailed && (
        <span className="text-red-700" role="alert">
          No se pudo cerrar la sesión.
        </span>
      )}
      <NavLink to="/registrar-recurso" className={navLinkClass}>
        Registrar recurso
      </NavLink>
      <span className="truncate text-slate-600" title={account.email}>
        {account.email}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="shrink-0 font-medium text-slate-900 underline hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
    </div>
  )
}
