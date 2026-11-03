import { Link, useLocation } from 'react-router'

import { buttonClasses } from '../components/ui/button.js'
import Notice from '../components/ui/Notice.jsx'

/**
 * Aviso para quien intenta participar sin sesión: iniciarla o crear una
 * cuenta. La página viaja en el estado de la navegación para volver a ella al
 * entrar, como con SignInRedirect.
 */
export default function SignInNotice({ title, children }) {
  const { pathname } = useLocation()
  const origin = { from: pathname }
  return (
    <Notice
      title={title}
      action={
        <div className="flex flex-wrap gap-3">
          <Link to="/iniciar-sesion" state={origin} className={buttonClasses('primary')}>
            Iniciar sesión
          </Link>
          <Link to="/registro" state={origin} className={buttonClasses('secondary')}>
            Crear cuenta
          </Link>
        </div>
      }
    >
      {children}
    </Notice>
  )
}
