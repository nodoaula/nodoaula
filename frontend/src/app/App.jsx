import { BrowserRouter, Link, Route, Routes } from 'react-router'

import LoginPage from '../features/account/LoginPage.jsx'
import RegisterPage from '../features/account/RegisterPage.jsx'
import CreateResourcePage from '../features/catalog/CreateResourcePage.jsx'
import ResourceCatalogPage from '../features/catalog/ResourceCatalogPage.jsx'
import ResourceDetailPage from '../features/catalog/ResourceDetailPage.jsx'
import SessionProvider from '../session/SessionProvider.jsx'
import AppLayout from './AppLayout.jsx'
import { SERVER_STATUS, useServerStatus } from './serverStatus.js'

export default function App() {
  const serverStatus = useServerStatus()

  // La sesión se consulta solo con el servidor ya despierto: antes, la
  // pregunta se perdería en la espera del arranque.
  if (serverStatus === SERVER_STATUS.READY) {
    return (
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<ResourceCatalogPage />} />
              <Route path="recursos/:resourceId" element={<ResourceDetailPage />} />
              <Route path="registrar-recurso" element={<CreateResourcePage />} />
              <Route path="registro" element={<RegisterPage />} />
              <Route path="iniciar-sesion" element={<LoginPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-slate-900">NodoAula</h1>
        <p className="mt-2 text-slate-600">Plataforma en construcción</p>
        <ServerNotice status={serverStatus} />
      </div>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-900">Página no encontrada</h1>
        <p className="mt-2 text-sm text-slate-600">
          La dirección no corresponde a ninguna página.{' '}
          <Link to="/" className="font-medium text-slate-900 underline">
            Volver al catálogo
          </Link>
        </p>
      </div>
    </main>
  )
}

// Los atributos role avisan a un lector de pantalla de que el texto cambió:
// "status" espera a que termine de leer lo anterior, "alert" interrumpe.
function ServerNotice({ status }) {
  if (status === SERVER_STATUS.STARTING) {
    return (
      <p className="mt-6 text-sm text-slate-500" role="status">
        El servidor está iniciando. Puede tardar un par de minutos.
      </p>
    )
  }

  return (
    <p className="mt-6 text-sm text-red-700" role="alert">
      No se pudo contactar con el servidor. Recarga la página para reintentar.
    </p>
  )
}
