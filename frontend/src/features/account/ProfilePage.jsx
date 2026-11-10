import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import Notice from '../../components/ui/Notice.jsx'
import { SESSION_STATUS } from '../../session/SessionContext.js'
import SignInRedirect from '../../session/SignInRedirect.jsx'
import { useLogout } from '../../session/useLogout.js'
import { useSession } from '../../session/useSession.js'
import { fetchProfile } from './api.js'
import { formatProfileDate, userTypeLabel } from './profile.js'
import { useDocumentTitle } from '../../lib/useDocumentTitle.js'

const NOT_AVAILABLE = 'No disponible'

function describeFailure(error) {
  if (error.status === 401) return 'Tu sesión terminó. Inicia sesión de nuevo para ver tu perfil.'
  if (error.status === null) return 'No se pudo contactar con el servidor. Revisa tu conexión y recarga la página.'
  return 'No se pudo cargar tu perfil por un error del servidor. Inténtalo de nuevo en unos minutos.'
}

function dateValue(isoInstant) {
  return isoInstant === null ? null : <time dateTime={isoInstant}>{formatProfileDate(isoInstant)}</time>
}

// Un dato del perfil; `value` null es uno que la cuenta no tiene. Se dice, en
// vez de dejar el hueco: así se distingue de un error al cargarlo.
function Row({ label, value, note }) {
  const missing = value === null
  return (
    <div className="grid gap-1 px-5 py-4 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="text-label text-content-muted">{label}</dt>
      <dd className={`min-w-0 text-body wrap-break-word ${missing ? 'text-content-faint' : 'text-content'}`}>
        {missing ? NOT_AVAILABLE : value}
        {note && <span className="mt-1 block text-label text-content-muted">{note}</span>}
      </dd>
    </div>
  )
}

/**
 * Perfil de la cuenta (HU506): todos los datos que NodoAula guarda de ella.
 * Solo existe para la cuenta con sesión; la API no tiene forma de pedir el de
 * otra. Un dato que la cuenta no tiene se muestra como «No disponible».
 */
export default function ProfilePage() {
  useDocumentTitle('Tu perfil')
  const { status, account } = useSession()
  const { loggingOut, logoutFailed, handleLogout } = useLogout()
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const accountId = account?.id

  useEffect(() => {
    if (accountId === undefined) return undefined
    let active = true
    fetchProfile()
      .then((loaded) => {
        if (active) setProfile(loaded)
      })
      .catch((error) => {
        console.error('No se pudo cargar el perfil', error)
        if (active) setLoadError(error)
      })
    return () => {
      active = false
    }
  }, [accountId])

  // Mientras no se sabe si hay sesión no se decide nada.
  if (status === SESSION_STATUS.LOADING) return null
  if (account === null) return <SignInRedirect />

  let content
  if (loadError) {
    content = (
      <Notice role="alert" title="No se pudo cargar tu perfil">
        {describeFailure(loadError)}
      </Notice>
    )
  } else if (profile === null) {
    content = <output className="block text-body text-content-muted">Cargando tu perfil…</output>
  } else {
    content = (
      <dl className="divide-y divide-border rounded-2xl border border-border bg-surface-raised">
        <Row label="Nombre" value={profile.name} />
        <Row label="Correo" value={profile.email} note="Visible solo para ti" />
        <Row label="Institución" value={profile.institution?.name ?? null} />
        <Row label="Tipo de usuario" value={userTypeLabel(profile.userType)} />
        <Row label="Cuenta creada" value={dateValue(profile.createdAt)} />
        <Row
          label="Autorizaste la política de datos"
          value={dateValue(profile.dataProcessingAuthorizedAt)}
          note={
            <Link to="/politica-de-datos" className="text-accent underline underline-offset-3 hover:decoration-2">
              Ver la política de tratamiento de datos
            </Link>
          }
        />
        {profile.teamMember && <Row label="Rol" value="Cuenta del equipo de NodoAula: puede moderar el catálogo." />}
      </dl>
    )
  }

  return (
    <main className="px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-22">
      <div className="mx-auto max-w-160">
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
          Tu perfil
        </h1>
        <p className="mt-2.5 text-body text-content-muted">
          Estos son tus datos personales guardados en la plataforma NodoAula. 
          Cuando realizas un aporte, los otros usuarios solo podrán ver tu nombre, institución y tipo de de usuario (estudiante/profesor).
        </p>

        <div className="mt-8">{content}</div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={buttonClasses('secondary')}
          >
            {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
          {logoutFailed && (
            <span className="text-label text-error" role="alert">
              No se pudo cerrar la sesión.
            </span>
          )}
        </div>
      </div>
    </main>
  )
}
