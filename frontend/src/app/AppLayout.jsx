import { Link, NavLink, Outlet } from 'react-router'

function navLinkClass({ isActive }) {
  return isActive ? 'font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900'
}

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            NodoAula
          </Link>
          <div className="flex gap-4 text-sm">
            <NavLink to="/iniciar-sesion" className={navLinkClass}>
              Iniciar sesión
            </NavLink>
            <NavLink to="/registro" className={navLinkClass}>
              Crear cuenta
            </NavLink>
          </div>
        </nav>
      </header>

      <Outlet />
    </div>
  )
}
