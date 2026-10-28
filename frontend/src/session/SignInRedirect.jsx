import { Navigate, useLocation } from 'react-router'

/**
 * Lleva al inicio de sesión desde una página que la exige, recordando esa
 * página para volver a ella al entrar.
 */
export default function SignInRedirect() {
  const { pathname, search } = useLocation()
  return <Navigate to="/iniciar-sesion" state={{ from: pathname + search }} replace />
}
