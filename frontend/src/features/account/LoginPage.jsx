import { useState } from 'react'
import { Link, useLocation } from 'react-router'

import TextField from '../../components/ui/TextField.jsx'

/**
 * Pantalla de inicio de sesión. Recibe el correo del registro en el estado de
 * la navegación, no en la dirección, para que no quede en el historial ni en
 * los registros del servidor.
 *
 * El envío de las credenciales corresponde a HU103; hasta entonces el botón
 * queda desactivado y la pantalla solo sirve de destino tras el registro.
 */
export default function LoginPage() {
  const location = useLocation()
  const justRegistered = location.state?.justRegistered === true

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [password, setPassword] = useState('')

  return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold text-slate-900">Iniciar sesión</h1>

        {justRegistered && (
          <p
            className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
            role="status"
          >
            Tu cuenta se creó. Inicia sesión con tu correo y tu contraseña.
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={(event) => event.preventDefault()} noValidate>
          <TextField
            id="login-email"
            label="Correo"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {/* Con el correo ya escrito, el foco va directo a la contraseña. */}
          <TextField
            id="login-password"
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            autoFocus={email !== ''}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <p className="text-sm text-slate-500">El inicio de sesión estará disponible próximamente.</p>

          <button
            type="submit"
            disabled
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Iniciar sesión
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-medium text-slate-900 underline">
            Crea una
          </Link>
        </p>
      </div>
    </main>
  )
}
