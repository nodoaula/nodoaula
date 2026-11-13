import { Outlet } from 'react-router'

import SiteHeader from './SiteHeader.jsx'

/** Marco de las páginas interiores: la cabecera común sobre el fondo de la identidad. */
export default function AppLayout() {
  return (
    <div className="min-h-screen bg-surface text-content">
      <div className="border-b border-border bg-surface">
        <SiteHeader />
      </div>
      <Outlet />
    </div>
  )
}
