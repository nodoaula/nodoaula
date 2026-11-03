import { Navigate, Outlet, useLocation } from 'react-router'

import { useSession } from './useSession.js'

const COMPLETE_PROFILE_PATH = '/completar-perfil'

// Lo que se puede ver con el perfil a medias: el paso de completarlo y la
// política que hay que leer para autorizar.
const ALLOWED_WITHOUT_PROFILE = new Set([COMPLETE_PROFILE_PATH, '/politica-de-datos'])

/**
 * Una cuenta creada antes de que el registro pidiera el perfil lo completa al
 * volver a iniciar sesión (HU506): desde cualquier otra página se la lleva a
 * completarlo, recordando a dónde iba para volver al terminar.
 */
export default function RequireCompleteProfile() {
  const { account } = useSession()
  const { pathname, search } = useLocation()

  if (account !== null && !account.profileComplete && !ALLOWED_WITHOUT_PROFILE.has(pathname)) {
    return <Navigate to={COMPLETE_PROFILE_PATH} state={{ from: pathname + search }} replace />
  }

  return <Outlet />
}
