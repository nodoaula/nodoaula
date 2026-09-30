import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'

import TextField from '../../components/ui/TextField.jsx'
import { CSRF_ERROR_CODE } from '../../lib/apiClient.js'
import { useSession } from '../../session/useSession.js'
import { validateLogin } from './validation.js'

const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS'

// Traduce el error de la API al aviso del formulario. Las credenciales
// incorrectas no se señalan en un campo concreto: el backend no dice cuál
// falló, para no revelar si el correo tiene cuenta.
function describeFailure(error) {
  if (error.code === INVALID_CREDENTIALS) {
    return 'El correo o la contraseña no son correctos.'
  }

  if (error.code === CSRF_ERROR_CODE) {
    return 'No se pudo verificar la seguridad del formulario. Recarga la página e inténtalo de nuevo.'
  }

  // Iniciar sesión dos veces no hace daño, así que aquí sí se puede invitar a
  // repetir sin más.
  if (error.timedOut) {
    return 'El servidor tardó demasiado en responder. Vuelve a intentarlo.'
  }

  if (error.status === null) {
    return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
  }

  return 'No se pudo iniciar sesión por un error del servidor. Inténtalo de nuevo en unos minutos.'
}

/**
 * Pantalla de inicio de sesión. Recibe el correo del registro en el estado de
 * la navegación, no en la dirección, para que no quede en el historial ni en
 * los registros del servidor. Con la sesión ya iniciada lleva al catálogo.
 */
export default function LoginPage() {
  const location = useLocation()
  const justRegistered = location.state?.justRegistered === true
  const { account, login } = useSession()

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Cubre tanto a quien llega con la sesión iniciada como el final de un
  // inicio de sesión correcto: al guardarse la cuenta, esta pantalla se va.
  if (account !== null) {
    return <Navigate to="/" replace />
  }

  function changeEmail(value) {
    setEmail(value)
    setFieldErrors((errors) => ({ ...errors, email: undefined }))
  }

  function changePassword(value) {
    setPassword(value)
    setFieldErrors((errors) => ({ ...errors, password: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    // El correo se recorta como en el registro; la contraseña no, porque un
    // espacio en ella sí cuenta.
    const data = { email: email.trim(), password }

    const errors = validateLogin(data)
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await login(data)
    } catch (error) {
      console.error('No se pudo iniciar sesión', error)
      setFormError(describeFailure(error))
      if (error.code === INVALID_CREDENTIALS) setPassword('')
      setSubmitting(false)
    }
  }

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

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <TextField
            id="login-email"
            label="Correo"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => changeEmail(event.target.value)}
            error={fieldErrors.email}
          />

          {/* Con el correo ya escrito, el foco va directo a la contraseña. */}
          <TextField
            id="login-password"
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus={email !== ''}
            value={password}
            onChange={(event) => changePassword(event.target.value)}
            error={fieldErrors.password}
          />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            Mostrar contraseña
          </label>

          {formError && (
            <p className="text-sm text-red-700" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
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
