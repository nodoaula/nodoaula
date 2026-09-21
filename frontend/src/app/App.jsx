import ResourceCatalogPage from '../features/catalog/ResourceCatalogPage.jsx'
import { SERVER_STATUS, useServerStatus } from './serverStatus.js'

export default function App() {
  const serverStatus = useServerStatus()

  if (serverStatus === SERVER_STATUS.READY) {
    return <ResourceCatalogPage />
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
