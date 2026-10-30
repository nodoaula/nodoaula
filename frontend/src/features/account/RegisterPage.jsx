import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import Notice from '../../components/ui/Notice.jsx'
import PasswordInput from '../../components/ui/PasswordInput.jsx'
import TextInput from '../../components/ui/TextInput.jsx'
import { useFocusFirstInvalid } from '../../components/ui/useFocusFirstInvalid.js'
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

/**
 * Pantalla de registro. Al crear la cuenta inicia la sesión y vuelve a la
 * página de la que se venía (`from`, en el estado de la navegación) o al
 * catálogo. Si ese inicio de sesión falla, la cuenta ya existe: lleva al
 * inicio de sesión con el correo puesto.
 */
export default function RegisterPage() {
  const navigate = useNavigate()
  const from = useLocation().state?.from
  const { account, login } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [dataProcessingAuthorized, setDataProcessingAuthorized] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [emailInUse, setEmailInUse] = useState(false)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formRef, focusFirstInvalid] = useFocusFirstInvalid()

  // Con la sesión iniciada, crear otra cuenta no tiene sentido desde aquí.
  // Es también como termina un registro correcto.
  if (account !== null) {
    return <Navigate to={from ?? '/catalogo'} replace />
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

  function changeDataProcessingAuthorized(checked) {
    setDataProcessingAuthorized(checked)
    clearFieldError('dataProcessingAuthorized')
  }

  function reject(failure) {
    setFieldErrors(failure.fieldErrors ?? {})
    setEmailInUse(failure.emailInUse ?? false)
    setFormError(failure.formError ?? null)
    focusFirstInvalid()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    // El correo se recorta porque un espacio pegado al copiarlo no es parte
    // de él. La contraseña no: un espacio en ella sí cuenta.
    const data = { email: email.trim(), password, dataProcessingAuthorized }

    const errors = validateRegistration(data)
    if (Object.keys(errors).length > 0) {
      reject({ fieldErrors: errors })
      return
    }

    setSubmitting(true)
    setFieldErrors({})
    setEmailInUse(false)
    setFormError(null)
    let created
    try {
      created = await registerAccount(data)
    } catch (error) {
      console.error('No se pudo crear la cuenta', error)
      reject(describeFailure(error))
      setSubmitting(false)
      return
    }

    try {
      await login({ email: data.email, password })
    } catch (error) {
      console.error('Se creó la cuenta, pero no se pudo iniciar la sesión', error)
      navigate('/iniciar-sesion', { state: { email: created.email, justRegistered: true, from } })
    }
  }

  return (
    <main className="px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-22">
      <div className="mx-auto max-w-105">
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
          Crear una cuenta
        </h1>
        <p className="mt-2.5 text-body text-content-muted">
          Con una cuenta puedes aportar recursos y leer los apuntes completos. Para consultar el catálogo no necesitas
          una.
        </p>

        <form ref={formRef} className="mt-8 flex flex-col gap-5.5" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-2">
            <TextInput
              id="register-email"
              label="Correo"
              type="email"
              autoComplete="email"
              value={email}
              onChange={changeEmail}
              hint="Nadie más lo verá."
              error={fieldErrors.email}
            />
            {emailInUse && (
              <p className="text-label text-content-muted">
                ¿Es tuya?{' '}
                <Link
                  to="/iniciar-sesion"
                  state={{ email: email.trim(), from }}
                  className="font-medium text-accent hover:underline"
                >
                  Inicia sesión
                </Link>
              </p>
            )}
          </div>

          <PasswordInput
            id="register-password"
            label="Contraseña"
            autoComplete="new-password"
            value={password}
            onChange={changePassword}
            hint={`Entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`}
            error={fieldErrors.password}
          />

          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-content">
              <input
                id="register-data-processing"
                type="checkbox"
                checked={dataProcessingAuthorized}
                onChange={(event) => changeDataProcessingAuthorized(event.target.checked)}
                aria-invalid={fieldErrors.dataProcessingAuthorized ? true : undefined}
                aria-describedby={fieldErrors.dataProcessingAuthorized ? 'register-data-processing-error' : undefined}
                className="mt-0.5 size-4.5 shrink-0 scheme-dark accent-accent"
              />
              <span>
                Tengo 18 años o más y autorizo el tratamiento de mis datos personales según la{' '}
                <a
                  href="/politica-de-datos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-3 hover:decoration-2"
                >
                  política (se abre en otra pestaña)
                </a>
                .
              </span>
            </label>
            {fieldErrors.dataProcessingAuthorized && (
              <p id="register-data-processing-error" className="pl-7.5 text-label text-error">
                {fieldErrors.dataProcessingAuthorized}
              </p>
            )}
          </div>

          {formError && (
            <Notice role="alert" title="No se completó el registro">
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
            {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-7 text-sm text-content-muted">
          ¿Ya tienes cuenta?{' '}
          <Link to="/iniciar-sesion" state={{ from }} className="font-medium text-accent hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  )
}
