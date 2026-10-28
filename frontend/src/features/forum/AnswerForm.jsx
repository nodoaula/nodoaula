import { useState } from 'react'

import { buttonClasses } from '../../components/ui/button.js'
import TextInput from '../../components/ui/TextInput.jsx'
import { createAnswer } from './api.js'
import { describeForumFailure } from './forumFailures.js'

const MAX_BODY = 5000
const FIELD_ID = 'tu-respuesta'
const HINT_ID = `${FIELD_ID}-ayuda`

function validate(body) {
  if (body.trim() === '') return 'Escribe tu respuesta antes de publicarla.'
  if (body.trim().length > MAX_BODY) return `La respuesta no puede tener más de ${MAX_BODY} caracteres.`
  return null
}

/**
 * Formulario para responder una pregunta (historia HU402). `fieldRef` llega
 * al campo, para que «Responder» lleve el foco a él. `onTimedOut` avisa de
 * que no se sabe si la respuesta se guardó.
 */
export default function AnswerForm({ questionId, onPublished, onTimedOut, fieldRef }) {
  const [body, setBody] = useState('')
  const [bodyError, setBodyError] = useState(null)
  const [general, setGeneral] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setGeneral(null)

    const invalid = validate(body)
    setBodyError(invalid)
    if (invalid) {
      fieldRef.current?.focus()
      return
    }

    setBusy(true)
    try {
      const answer = await createAnswer(questionId, body.trim())
      setBody('')
      onPublished(answer)
    } catch (error) {
      const fieldError = error.code === 'VALIDATION_FAILED' && error.body?.errors?.find(({ field }) => field === 'body')
      if (fieldError) {
        setBodyError(fieldError.message)
      } else if (error.timedOut) {
        setGeneral('El servidor tardó demasiado. Actualizamos el hilo: revisa si tu respuesta aparece antes de volver a enviarla.')
        onTimedOut()
      } else {
        setGeneral(describeForumFailure(error, 'No se pudo publicar la respuesta. Intenta de nuevo.'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Responder la pregunta" className="mt-8 flex max-w-150 flex-col gap-2.5">
      {/* El margen sobre el límite deja escribir de más y ver el error, en
          lugar de cortar el texto en silencio. */}
      <TextInput
        id={FIELD_ID}
        ref={fieldRef}
        label="Tu respuesta"
        multiline
        rows={5}
        value={body}
        maxLength={MAX_BODY + 50}
        placeholder="Explica cómo lo resolviste o dónde encontrarlo en el catálogo"
        error={bodyError}
        aria-describedby={bodyError ? `${FIELD_ID}-error ${HINT_ID}` : HINT_ID}
        onChange={setBody}
      />
      {general && (
        <p role="alert" className="text-label text-error">
          {general}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span id={HINT_ID} className="font-mono text-label text-content-muted">
          Hasta {MAX_BODY} caracteres
        </span>
        <button type="submit" disabled={busy} className={buttonClasses('primary')}>
          {busy ? 'Publicando…' : 'Publicar respuesta'}
        </button>
      </div>
    </form>
  )
}
