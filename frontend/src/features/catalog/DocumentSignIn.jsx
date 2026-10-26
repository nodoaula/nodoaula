import { Link, useLocation } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'

/** En lugar del apunte, sin sesión y sin vista previa (historia HU411). */
export default function DocumentSignIn() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-raised px-6 py-14 text-center">
      <SignInInvitation title="Inicia sesión para leer este apunte">
        Con una cuenta puedes leerlo completo y descargarlo. Crear una es gratis.
      </SignInInvitation>
    </section>
  )
}

/**
 * Candado, título, texto y las acciones de iniciar sesión y crear una cuenta,
 * para un contenedor en columna. La ficha viaja en el estado de la navegación
 * para volver a ella al iniciar sesión.
 */
export function SignInInvitation({ title, children }) {
  const { pathname } = useLocation()
  const origin = { from: pathname }

  return (
    <>
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-accent/12 text-accent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <h2 className="mt-1 text-lead font-semibold tracking-tight text-content">{title}</h2>
      <p className="max-w-sm text-body text-content-muted">{children}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <Link to="/iniciar-sesion" state={origin} className={buttonClasses('primary')}>
          Iniciar sesión
        </Link>
        <Link to="/registro" state={origin} className={buttonClasses('secondary')}>
          Crear cuenta
        </Link>
      </div>
    </>
  )
}
