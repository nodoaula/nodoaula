import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'

import TextField from '../../components/ui/TextField.jsx'
import { CSRF_ERROR_CODE } from '../../lib/apiClient.js'
import { useSession } from '../../session/useSession.js'
import { registerAccount } from './api.js'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validateRegistration } from './validation.js'

const EMAIL_ALREADY_IN_USE = 'EMAIL_ALREADY_IN_USE'
const VALIDATION_FAILED = 'VALIDATION_FAILED'

// Traduce el error de la API al mensaje del formulario. Lo que se refiere a un
// campo va junto al campo; el resto, en un aviso general.
function describeFailure(error) {
  if (error.code === EMAIL_ALREADY_IN_USE) {
    return { fieldErrors: { email: 'Ya existe una cuenta con este correo.' }, emailInUse: true }
  }

  if (error.code === VALIDATION_FAILED && Array.isArray(error.body?.errors)) {
    const fieldErrors = {}
    for (const { field, message } of error.body.errors) {
      fieldErrors[field] ??= message
    }
    return { fieldErrors }
  }

  if (error.code === CSRF_ERROR_CODE) {
    return {
      formError: 'No se pudo verificar la seguridad del formulario. Recarga la página e inténtalo de nuevo.',
    }
  }

  // Tras un tiempo agotado no se sabe si la cuenta llegó a crearse. Repetir
  // es seguro: si se creó, el aviso de correo en uso lo dirá.
  if (error.timedOut) {
    return {
      formError:
        'El servidor tardó demasiado en responder y no sabemos si la cuenta se creó. Vuelve a intentarlo: si ya existe, te avisaremos de que el correo está en uso.',
    }
  }

  if (error.status === null) {
    return { formError: 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.' }
  }

  return { formError: 'No se pudo crear la cuenta por un error del servidor. Inténtalo de nuevo en unos minutos.' }
}

/** Pantalla de registro. Registrarse no inicia sesión: al terminar lleva al inicio de sesión. */
export default function RegisterPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [emailInUse, setEmailInUse] = useState(false)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { account } = useSession()

  // Con la sesión iniciada, crear otra cuenta no tiene sentido desde aquí.
  if (account !== null) {
    return <Navigate to="/" replace />
  }

  // Al editar un campo su error deja de aplicar; los de los demás se quedan.
  function clearFieldError(field) {
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }))
  }

  function changeEmail(value) {
    setEmail(value)
    setEmailInUse(false)
    clearFieldError('email')
  }

  function changePassword(value) {
    setPassword(value)
    clearFieldError('password')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    // El correo se recorta porque un espacio pegado al copiarlo no es parte
    // de él. La contraseña no: un espacio en ella sí cuenta.
    const data = { email: email.trim(), password }

    const errors = validateRegistration(data)
    setFieldErrors(errors)
    setEmailInUse(false)
    setFormError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const account = await registerAccount(data)
      navigate('/iniciar-sesion', { state: { email: account.email, justRegistered: true } })
    } catch (error) {
      console.error('No se pudo crear la cuenta', error)
      const failure = describeFailure(error)
      setFieldErrors(failure.fieldErrors ?? {})
      setEmailInUse(failure.emailInUse ?? false)
      setFormError(failure.formError ?? null)
      setSubmitting(false)
    }
  }

  return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold text-slate-900">Crear una cuenta</h1>
        <p className="mt-2 text-sm text-slate-600">
          Con una cuenta puedes aportar recursos al catálogo. Para consultarlo no necesitas una.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <TextField
            id="register-email"
            label="Correo"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => changeEmail(event.target.value)}
            error={fieldErrors.email}
          />
          {emailInUse && (
            <p className="-mt-2 text-sm text-slate-600">
              ¿Es tuya?{' '}
              <Link
                to="/iniciar-sesion"
                state={{ email: email.trim() }}
                className="font-medium text-slate-900 underline"
              >
                Inicia sesión
              </Link>
            </p>
          )}

          <TextField
            id="register-password"
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(event) => changePassword(event.target.value)}
            hint={`Entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`}
            error={fieldErrors.password}
          />

          {/* Sin recuperación de contraseña, un error al escribirla deja la
              cuenta inaccesible; poder verla ayuda a evitarlo. */}
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
            {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          ¿Ya tienes cuenta?{' '}
          <Link to="/iniciar-sesion" className="font-medium text-slate-900 underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  )
}
