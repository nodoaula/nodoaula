import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import Notice from '../../components/ui/Notice.jsx'
import TextInput from '../../components/ui/TextInput.jsx'
import { useFocusFirstInvalid } from '../../components/ui/useFocusFirstInvalid.js'
import { CSRF_ERROR_CODE } from '../../lib/apiClient.js'
import { tidyText } from '../../lib/text.js'
import { fetchCurrentAccount } from '../../session/api.js'
import { SESSION_STATUS } from '../../session/SessionContext.js'
import SignInRedirect from '../../session/SignInRedirect.jsx'
import { useSession } from '../../session/useSession.js'
import { completeProfile } from './api.js'
import DataProcessingConsent from './DataProcessingConsent.jsx'
import InstitutionPicker from './InstitutionPicker.jsx'
import { useInstitutions } from './useInstitutions.js'
import UserTypeField from './UserTypeField.jsx'
import { validateProfileCompletion } from './validation.js'

const VALIDATION_FAILED = 'VALIDATION_FAILED'
const PROFILE_ALREADY_COMPLETE = 'PROFILE_ALREADY_COMPLETE'

// Traduce el error de la API al mensaje del formulario, como en el registro:
// lo que se refiere a un campo va junto al campo; el resto, en un aviso.
function describeFailure(error) {
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

  if (error.status === 401) {
    return { formError: 'Tu sesión terminó. Inicia sesión de nuevo para completar tu perfil.' }
  }

  // Repetir no hace daño: si el primer envío llegó, el backend responde que el
  // perfil ya está completo, y eso se trata como éxito.
  if (error.timedOut) {
    return { formError: 'El servidor tardó demasiado en responder. Vuelve a intentarlo.' }
  }

  if (error.status === null) {
    return { formError: 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.' }
  }

  return { formError: 'No se pudo guardar tu perfil por un error del servidor. Inténtalo de nuevo en unos minutos.' }
}

/**
 * Paso en que una cuenta creada antes de HU506 completa su perfil y da la
 * nueva autorización, que la política exige porque ahora estos datos se
 * muestran junto a lo que la cuenta aporta. Llega aquí al iniciar sesión, desde
 * RequireCompleteProfile, y al terminar vuelve a la página a la que iba.
 */
export default function CompleteProfilePage() {
  const from = useLocation().state?.from
  const { status, account, updateAccount } = useSession()
  const { institutions, failed: institutionsFailed } = useInstitutions()

  const [name, setName] = useState('')
  const [institution, setInstitution] = useState(null)
  const [userType, setUserType] = useState(null)
  const [dataProcessingAuthorized, setDataProcessingAuthorized] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formRef, focusFirstInvalid] = useFocusFirstInvalid()

  // Mientras no se sabe si hay sesión no se decide nada.
  if (status === SESSION_STATUS.LOADING) return null
  if (account === null) return <SignInRedirect />

  // Cubre a quien ya tiene el perfil y el final de un envío correcto: al
  // guardarse la cuenta completa, esta pantalla se va.
  if (account.profileComplete) {
    return <Navigate to={from ?? '/catalogo'} replace />
  }

  function clearFieldError(field) {
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }))
  }

  function reject(failure) {
    setFieldErrors(failure.fieldErrors ?? {})
    setFormError(failure.formError ?? null)
    focusFirstInvalid()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const data = { name: tidyText(name), institutionId: institution?.id ?? null, userType, dataProcessingAuthorized }

    const errors = validateProfileCompletion(data)
    if (Object.keys(errors).length > 0) {
      reject({ fieldErrors: errors })
      return
    }

    setSubmitting(true)
    setFieldErrors({})
    setFormError(null)
    try {
      updateAccount(await completeProfile(data))
    } catch (error) {
      // Ya estaba completo, como tras un primer envío cuya respuesta no llegó:
      // la cuenta se vuelve a leer para tener el nombre que quedó guardado.
      if (error.code === PROFILE_ALREADY_COMPLETE) {
        const current = await fetchCurrentAccount().catch(() => null)
        if (current !== null) {
          updateAccount(current)
          return
        }
      }
      console.error('No se pudo completar el perfil', error)
      reject(describeFailure(error))
      setSubmitting(false)
    }
  }

  return (
    <main className="px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-22">
      <div className="mx-auto max-w-105">
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
          Completa tu perfil
        </h1>
        <p className="mt-2.5 text-body text-content-muted">
          Ahora NodoAula muestra tu nombre, tu institución y si eres estudiante o docente junto a lo que aportas, para
          que quien lo vea pueda valorar su procedencia. Como la política de tratamiento de datos cambió por eso, también
          te pedimos que la autorices de nuevo.
        </p>

        <form ref={formRef} className="mt-8 flex flex-col gap-5.5" onSubmit={handleSubmit} noValidate>
          <TextInput
            id="profile-name"
            label="Nombre"
            autoComplete="name"
            value={name}
            onChange={(value) => {
              setName(value)
              clearFieldError('name')
            }}
            hint="Se mostrará junto a lo que aportes."
            error={fieldErrors.name}
          />

          <InstitutionPicker
            id="profile-institution"
            institutions={institutions}
            loadFailed={institutionsFailed}
            value={institution}
            onChange={(value) => {
              setInstitution(value)
              clearFieldError('institutionId')
            }}
            error={fieldErrors.institutionId}
          />

          <UserTypeField
            id="profile-user-type"
            value={userType}
            onChange={(value) => {
              setUserType(value)
              clearFieldError('userType')
            }}
            error={fieldErrors.userType}
          />

          <DataProcessingConsent
            id="profile-data-processing"
            checked={dataProcessingAuthorized}
            onChange={(checked) => {
              setDataProcessingAuthorized(checked)
              clearFieldError('dataProcessingAuthorized')
            }}
            error={fieldErrors.dataProcessingAuthorized}
          />

          {formError && (
            <Notice role="alert" title="No se guardó tu perfil">
              {formError}
            </Notice>
          )}

          {/* aria-disabled y no disabled, como en el registro: un botón
              deshabilitado pierde el foco. */}
          <button
            type="submit"
            aria-disabled={submitting}
            className={`${buttonClasses('primary', 'lg')} w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
          >
            {submitting ? 'Guardando…' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </main>
  )
}
