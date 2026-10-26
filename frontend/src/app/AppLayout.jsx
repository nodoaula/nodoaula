import { Outlet } from 'react-router'

import SiteHeader from './SiteHeader.jsx'

/**
 * Marco de las páginas interiores: la cabecera común sobre el fondo de la
 * identidad. `legacy` marca las pantallas que aún no se han rediseñado:
 * conservan su fondo claro, porque su texto oscuro no se leería sobre el
 * fondo nuevo.
 */
export default function AppLayout({ legacy = false }) {
  return (
    <div className={`min-h-screen ${legacy ? 'bg-slate-50' : 'bg-surface text-content'}`}>
      <div className="border-b border-border bg-surface">
        <SiteHeader />
      </div>
      <Outlet />
    </div>
  )
}
