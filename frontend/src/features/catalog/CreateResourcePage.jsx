import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import TextField from '../../components/ui/TextField.jsx'
import { CSRF_ERROR_CODE } from '../../lib/apiClient.js'
import { SESSION_STATUS } from '../../session/SessionContext.js'
import { useSession } from '../../session/useSession.js'
import { createResource, listCoursesWithResources } from './api.js'
import { parseTopics, validateCreateResource } from './validation.js'

const VALIDATION_FAILED = 'VALIDATION_FAILED'

const RESOURCE_TYPE_OPTIONS = [
  { value: 'VIDEO', label: 'Video' },
  { value: 'DOCUMENT', label: 'Documento' },
]

const EMPTY_FORM = {
  title: '',
  description: '',
  publishedAt: '',
  durationSeconds: '',
  channel: '',
  url: '',
  resourceType: '',
  course: '',
  topicsText: '',
}

// Traduce el error de la API al mensaje del formulario. Lo que se refiere a un
// campo va junto al campo; el resto, en un aviso general.
function describeFailure(error) {
  if (error.code === VALIDATION_FAILED && Array.isArray(error.body?.errors)) {
    const fieldErrors = {}
    for (const { field, message } of error.body.errors) {
      // "topics[0]" del backend se marca en el mismo campo que "topics" aquí.
      const formField = field.startsWith('topics') ? 'topics' : field
      fieldErrors[formField] ??= message
    }
    return { fieldErrors }
  }

  if (error.code === CSRF_ERROR_CODE) {
    return {
      formError: 'No se pudo verificar la seguridad del formulario. Recarga la página e inténtalo de nuevo.',
    }
  }

  if (error.status === 401) {
    return { formError: 'Tu sesión ya no está activa. Vuelve a iniciar sesión e inténtalo de nuevo.' }
  }

  // Tras un tiempo agotado no se sabe si el recurso llegó a crearse. No se
  // reintenta solo: el usuario decide, revisando primero el catálogo.
  if (error.timedOut) {
    return {
      formError:
        'El servidor tardó demasiado en responder y no sabemos si el recurso se registró. Revisa el catálogo antes de volver a intentarlo.',
    }
  }

  if (error.status === null) {
    return { formError: 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.' }
  }

  return { formError: 'No se pudo registrar el recurso por un error del servidor. Inténtalo de nuevo en unos minutos.' }
}

/**
 * Formulario de registro manual de un recurso (historia HU105). Solo
 * accesible con sesión iniciada: el catálogo se consulta sin cuenta, pero
 * aportar la exige (ADR-007).
 */
export default function CreateResourcePage() {
  const navigate = useNavigate()
  const { status, account } = useSession()
  const [courses, setCourses] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    // Solo para sugerir cursos ya usados en el campo; no es la lista completa
    // del vocabulario controlado, y el campo sigue aceptando uno nuevo.
    listCoursesWithResources()
      .then((data) => {
        if (active) setCourses(data)
      })
      .catch((error) => console.error('No se pudo cargar la lista de cursos', error))

    return () => {
      active = false
    }
  }, [])

  // Mientras no se sabe si hay sesión no se decide nada; sin ella, no hay
  // nada que hacer aquí.
  if (status === SESSION_STATUS.LOADING) return null
  if (account === null) {
    return <Navigate to="/iniciar-sesion" replace />
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const data = {
      title: form.title.trim(),
      description: form.description.trim(),
      publishedAt: form.publishedAt,
      durationSeconds: form.durationSeconds.trim(),
      channel: form.channel.trim(),
      url: form.url.trim(),
      resourceType: form.resourceType,
      course: form.course.trim(),
      topics: parseTopics(form.topicsText),
    }

    const errors = validateCreateResource(data)
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await createResource({
        title: data.title,
        description: data.description === '' ? null : data.description,
        publishedAt: data.publishedAt,
        durationSeconds: data.durationSeconds === '' ? null : Number(data.durationSeconds),
        channel: data.channel === '' ? null : data.channel,
        url: data.url,
        resourceType: data.resourceType,
        course: data.course,
        topics: data.topics,
      })

      // Vuelve al catálogo, que se vuelve a cargar al montarse y así muestra
      // el recurso recién creado sin necesidad de refrescar nada a mano.
      navigate('/', { state: { resourceCreated: true } })
    } catch (error) {
      console.error('No se pudo registrar el recurso', error)
      const failure = describeFailure(error)
      setFieldErrors(failure.fieldErrors ?? {})
      setFormError(failure.formError ?? null)
      setSubmitting(false)
    }
  }

  return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold text-slate-900">Registrar un recurso</h1>
        <p className="mt-2 text-sm text-slate-600">
          Se publica en el catálogo asociado a tu cuenta ({account.email}).
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <TextField
            id="resource-title"
            label="Título"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            error={fieldErrors.title}
          />

          <div>
            <label htmlFor="resource-description" className="block text-sm font-medium text-slate-700">
              Descripción
            </label>
            <textarea
              id="resource-description"
              rows={3}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              aria-invalid={fieldErrors.description ? true : undefined}
              className={`mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm ${
                fieldErrors.description ? 'border-red-500' : 'border-slate-300'
              }`}
            />
            {fieldErrors.description && (
              <p className="mt-1 text-sm text-red-700">{fieldErrors.description}</p>
            )}
          </div>

          <TextField
            id="resource-published-at"
            label="Fecha de publicación"
            type="date"
            value={form.publishedAt}
            onChange={(event) => updateField('publishedAt', event.target.value)}
            error={fieldErrors.publishedAt}
          />

          <TextField
            id="resource-duration"
            label="Duración"
            type="number"
            min="1"
            step="1"
            hint="En segundos. Déjalo en blanco si no la sabes."
            value={form.durationSeconds}
            onChange={(event) => updateField('durationSeconds', event.target.value)}
            error={fieldErrors.durationSeconds}
          />

          <TextField
            id="resource-channel"
            label="Canal"
            hint="Opcional: quién publicó el recurso."
            value={form.channel}
            onChange={(event) => updateField('channel', event.target.value)}
            error={fieldErrors.channel}
          />

          <TextField
            id="resource-url"
            label="Enlace"
            type="url"
            placeholder="https://…"
            value={form.url}
            onChange={(event) => updateField('url', event.target.value)}
            error={fieldErrors.url}
          />

          <div>
            <label htmlFor="resource-type" className="block text-sm font-medium text-slate-700">
              Tipo de recurso
            </label>
            <select
              id="resource-type"
              value={form.resourceType}
              onChange={(event) => updateField('resourceType', event.target.value)}
              aria-invalid={fieldErrors.resourceType ? true : undefined}
              className={`mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm ${
                fieldErrors.resourceType ? 'border-red-500' : 'border-slate-300'
              }`}
            >
              <option value="">Elige uno…</option>
              {RESOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldErrors.resourceType && (
              <p className="mt-1 text-sm text-red-700">{fieldErrors.resourceType}</p>
            )}
          </div>

          <TextField
            id="resource-course"
            label="Curso"
            list="resource-course-options"
            hint="Si el curso no existe todavía, se crea al registrar el recurso."
            value={form.course}
            onChange={(event) => updateField('course', event.target.value)}
            error={fieldErrors.course}
          />
          <datalist id="resource-course-options">
            {courses.map((course) => (
              <option key={course.id} value={course.name} />
            ))}
          </datalist>

          <TextField
            id="resource-topics"
            label="Temas"
            hint="Sepáralos con comas. Los que no existan en el curso se crean al registrar el recurso."
            placeholder="Spring Boot, Control de versiones"
            value={form.topicsText}
            onChange={(event) => updateField('topicsText', event.target.value)}
            error={fieldErrors.topics}
          />

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
            {submitting ? 'Registrando…' : 'Registrar recurso'}
          </button>
        </form>
      </div>
    </main>
  )
}
