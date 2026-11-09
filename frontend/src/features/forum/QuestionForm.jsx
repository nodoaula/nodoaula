import { useEffect, useRef, useState } from 'react'

import { buttonClasses } from '../../components/ui/button.js'
import Notice from '../../components/ui/Notice.jsx'
import TextInput from '../../components/ui/TextInput.jsx'
import { useFocusFirstInvalid } from '../../components/ui/useFocusFirstInvalid.js'
import { createQuestion } from './api.js'

const MAX_TITLE = 200
const MAX_BODY = 5000
const BODY_HINT_ID = 'question-body-hint'
const RESOURCE_HINT_ID = 'question-resource-hint'

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
  return { general: 'Intenta de nuevo; lo que escribiste sigue aquí.' }
}

/**
 * Formulario para publicar una pregunta en el foro de un curso (HU401). Se
 * abre con el foco en el título. El recurso es opcional: sirve para preguntar
 * sobre un video o apunte concreto.
 */
export default function QuestionForm({ courseId, resources, onPublished, onCancel }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [general, setGeneral] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formRef, focusFirstInvalid] = useFocusFirstInvalid()
  const titleRef = useRef(null)

  useEffect(() => titleRef.current.focus(), [])

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    setGeneral(null)

    const errors = validate({ title, body })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid()
      return
    }

    setBusy(true)
    try {
      const question = await createQuestion({
        courseId: Number(courseId),
        resourceId: resourceId === '' ? null : Number(resourceId),
        title: title.trim(),
        body: body.trim(),
      })
      onPublished(question)
    } catch (error) {
      const failure = describeFailure(error)
      setFieldErrors(failure.fieldErrors ?? {})
      setGeneral(failure.general ?? null)
      if (failure.fieldErrors) focusFirstInvalid()
      setBusy(false)
    }
  }

  const resourceError = fieldErrors.resourceId

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate aria-label="Publicar una pregunta" className="flex max-w-150 flex-col gap-5">
      {/* El margen sobre el límite deja escribir de más y ver el error, en
          lugar de cortar el texto en silencio. */}
      <TextInput
        id="question-title"
        ref={titleRef}
        label="Título"
        value={title}
        maxLength={MAX_TITLE + 50}
        error={fieldErrors.title}
        onChange={setTitle}
      />
      <TextInput
        id="question-body"
        label="Detalle"
        multiline
        rows={5}
        value={body}
        maxLength={MAX_BODY + 50}
        placeholder="Cuenta qué intentaste y en qué parte te trabaste"
        error={fieldErrors.body}
        aria-describedby={fieldErrors.body ? `question-body-error ${BODY_HINT_ID}` : BODY_HINT_ID}
        onChange={setBody}
      />

      {resources.length > 0 && (
        <div className="flex flex-col gap-2">
          <label htmlFor="question-resource" className="text-sm font-medium text-content">
            Recurso relacionado <span className="font-normal text-content-muted">opcional</span>
          </label>
          {/* La lista nativa: la abre el sistema, también en el celular. Su
              flecha se dibuja aparte porque appearance-none quita la propia. */}
          <div className="relative">
            <select
              id="question-resource"
              value={resourceId}
              aria-invalid={resourceError ? true : undefined}
              aria-describedby={resourceError ? `${RESOURCE_HINT_ID} question-resource-error` : RESOURCE_HINT_ID}
              onChange={(event) => setResourceId(event.target.value)}
              className={`w-full cursor-pointer appearance-none rounded-xl border bg-surface-raised py-3 pr-11 pl-3.5 text-base text-content scheme-dark focus:border-accent focus:outline-none sm:text-body ${
                resourceError ? 'border-error' : 'border-border-control hover:border-content-faint'
              }`}
            >
              <option value="">Ninguno</option>
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.title}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-content-muted"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          <p id={RESOURCE_HINT_ID} className="text-label text-content-muted">
            Para preguntar sobre un video o un apunte concreto.
          </p>
          {resourceError && (
            <p id="question-resource-error" className="text-label text-error">
              {resourceError}
            </p>
          )}
        </div>
      )}

      {fieldErrors.courseId && <p className="text-label text-error">{fieldErrors.courseId}</p>}
      {general && (
        <Notice title="No se pudo publicar la pregunta" role="alert">
          {general}
        </Notice>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span id={BODY_HINT_ID} className="font-mono text-label text-content-muted">
          Detalle hasta {MAX_BODY} caracteres
        </span>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className={buttonClasses('secondary')}>
            Cancelar
          </button>
          {/* aria-disabled y no disabled: un botón deshabilitado pierde el foco. */}
          <button
            type="submit"
            aria-disabled={busy}
            className={`${buttonClasses('primary')} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
          >
            {busy ? 'Publicando…' : 'Publicar pregunta'}
          </button>
        </div>
      </div>
    </form>
  )
}
