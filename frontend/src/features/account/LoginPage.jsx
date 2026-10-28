import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import Notice from '../../components/ui/Notice.jsx'
import PasswordInput from '../../components/ui/PasswordInput.jsx'
import TextInput from '../../components/ui/TextInput.jsx'
import { useFocusFirstInvalid } from '../../components/ui/useFocusFirstInvalid.js'
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
 * los registros del servidor. Con la sesión ya iniciada lleva a la página de
 * la que se venía, si la hay (`from`, por el mismo canal), o al catálogo.
 */
export default function LoginPage() {
  const location = useLocation()
  const justRegistered = location.state?.justRegistered === true
  const from = location.state?.from
  const { account, login } = useSession()

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formRef, focusFirstInvalid] = useFocusFirstInvalid()

  // Cubre tanto a quien llega con la sesión iniciada como el final de un
  // inicio de sesión correcto: al guardarse la cuenta, esta pantalla se va.
  if (account !== null) {
    return <Navigate to={from ?? '/catalogo'} replace />
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
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid()
      return
    }

    setSubmitting(true)
    try {
      await login(data)
    } catch (error) {
      console.error('No se pudo iniciar sesión', error)
      setFormError(describeFailure(error))
      // La contraseña se borra y el foco va a ella para escribirla de nuevo,
      // después de pintarse el aviso, que el lector de pantalla lee primero.
      if (error.code === INVALID_CREDENTIALS) {
        setPassword('')
        setTimeout(() => formRef.current?.querySelector('#login-password')?.focus())
      }
      setSubmitting(false)
    }
  }

  return (
    <main className="px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-22">
      <div className="mx-auto max-w-105">
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
          Iniciar sesión
        </h1>

        <form ref={formRef} className="mt-8 flex flex-col gap-5.5" onSubmit={handleSubmit} noValidate>
          {justRegistered && (
            <Notice title="Tu cuenta se creó">Inicia sesión con tu correo y tu contraseña.</Notice>
          )}

          <TextInput
            id="login-email"
            label="Correo"
            type="email"
            autoComplete="username"
            value={email}
            onChange={changeEmail}
            error={fieldErrors.email}
          />

          {/* Con el correo ya escrito, el foco va directo a la contraseña. */}
          <PasswordInput
            id="login-password"
            label="Contraseña"
            autoComplete="current-password"
            autoFocus={email !== ''}
            value={password}
            onChange={changePassword}
            error={fieldErrors.password}
          />

          {formError && (
            <Notice role="alert" title="No se inició la sesión">
              {formError}
            </Notice>
          )}

          {/* aria-disabled y no disabled: un botón deshabilitado pierde el foco,
              y tras un error quien usa el teclado volvería a empezar desde arriba.
              El envío doble lo evita la comprobación de handleSubmit. */}
          <button
            type="submit"
            aria-disabled={submitting}
            className={`${buttonClasses('primary', 'lg')} w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
          >
            {submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="mt-7 text-sm text-content-muted">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" state={{ from }} className="font-medium text-accent hover:underline">
            Crea una
          </Link>
        </p>
      </div>
    </main>
  )
}
