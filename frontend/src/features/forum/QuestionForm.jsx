import { useState } from 'react'

import { buttonClasses } from '../../components/ui/button.js'
import TextField from '../../components/ui/TextField.jsx'
import { createQuestion } from './api.js'

const MAX_TITLE = 200
const MAX_BODY = 5000

function validate({ title, body }) {
  const errors = {}
  if (title.trim() === '') errors.title = 'Escribe el título de tu pregunta.'
  else if (title.trim().length > MAX_TITLE) errors.title = `El título no puede pasar de ${MAX_TITLE} caracteres.`
  if (body.trim() === '') errors.body = 'Cuenta tu duda con más detalle.'
  else if (body.trim().length > MAX_BODY) errors.body = `El detalle no puede pasar de ${MAX_BODY} caracteres.`
  return errors
}

// Traduce el rechazo del backend a mensajes junto al campo o, si no es de un
// campo, a un aviso general.
function describeFailure(error) {
  if (error.code === 'VALIDATION_FAILED' && Array.isArray(error.body?.errors)) {
    const fieldErrors = {}
    for (const { field, message } of error.body.errors) fieldErrors[field] ??= message
    return { fieldErrors }
  }
  if (error.status === 401) return { general: 'Tu sesión terminó. Inicia sesión de nuevo para publicar.' }
  if (error.timedOut) return { general: 'El servidor tardó demasiado. Revisa la lista antes de volver a enviar.' }
  return { general: 'No se pudo publicar la pregunta. Intenta de nuevo.' }
}

/**
 * Formulario para publicar una pregunta en el foro de un curso (HU401). El
 * recurso es opcional: sirve para preguntar sobre un video o apunte concreto.
 */
export default function QuestionForm({ courseId, resources, onPublished }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [general, setGeneral] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setGeneral(null)

    const errors = validate({ title, body })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    try {
      const question = await createQuestion({
        courseId: Number(courseId),
        resourceId: resourceId === '' ? null : Number(resourceId),
        title: title.trim(),
        body: body.trim(),
      })
      setTitle('')
      setBody('')
      setResourceId('')
      onPublished(question)
    } catch (error) {
      const failure = describeFailure(error)
      setFieldErrors(failure.fieldErrors ?? {})
      setGeneral(failure.general ?? null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Publicar una pregunta" className="flex max-w-2xl flex-col gap-4">
      <TextField
        id="question-title"
        label="Título"
        value={title}
        maxLength={MAX_TITLE + 50}
        error={fieldErrors.title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <div>
        <label htmlFor="question-body" className="block text-sm font-medium text-slate-700">
          Detalle
        </label>
        <textarea
          id="question-body"
          rows={5}
          value={body}
          aria-invalid={fieldErrors.body ? true : undefined}
          aria-describedby={fieldErrors.body ? 'question-body-error' : undefined}
          onChange={(event) => setBody(event.target.value)}
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm ${
            fieldErrors.body ? 'border-red-500' : 'border-slate-300'
          } bg-white`}
        />
        {fieldErrors.body && (
          <p id="question-body-error" className="mt-1 text-sm text-red-700">
            {fieldErrors.body}
          </p>
        )}
      </div>

      {resources.length > 0 && (
        <div>
          <label htmlFor="question-resource" className="block text-sm font-medium text-slate-700">
            Recurso relacionado (opcional)
          </label>
          <select
            id="question-resource"
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Ninguno</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.title}
              </option>
            ))}
          </select>
          {fieldErrors.resourceId && <p className="mt-1 text-sm text-red-700">{fieldErrors.resourceId}</p>}
        </div>
      )}

      {fieldErrors.courseId && <p className="text-sm text-red-700">{fieldErrors.courseId}</p>}
      {general && (
        <p role="alert" className="text-sm text-red-700">
          {general}
        </p>
      )}

      <div>
        <button type="submit" disabled={busy} className={buttonClasses('primary')}>
          {busy ? 'Publicando…' : 'Publicar pregunta'}
        </button>
      </div>
    </form>
  )
}
