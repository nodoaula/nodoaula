import { useRef, useState } from 'react'

import { buttonClasses } from '../../components/ui/button.js'
import TextInput from '../../components/ui/TextInput.jsx'
import { createGroup } from './api.js'
import { describeCreateFailure, MAX_DESCRIPTION, MAX_NAME, validateGroup } from './validation.js'

const NAME_ID = 'grupo-nombre'
const DESCRIPTION_ID = 'grupo-descripcion'

/**
 * Formulario para crear un grupo de estudio en un curso (historia HU404). El
 * margen sobre los límites deja escribir de más y ver el error, en lugar de
 * cortar el texto en silencio. Tras un error, el foco va al primer campo con
 * error.
 */
export default function StudyGroupForm({ courseId, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [general, setGeneral] = useState(null)
  const [busy, setBusy] = useState(false)
  const nameField = useRef(null)
  const descriptionField = useRef(null)

  function showErrors(errors) {
    setFieldErrors(errors)
    if (errors.name) nameField.current?.focus()
    else if (errors.description) descriptionField.current?.focus()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setGeneral(null)

    const errors = validateGroup({ name, description })
    showErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    try {
      const group = await createGroup({
        courseId: Number(courseId),
        name: name.trim(),
        description: description.trim() === '' ? null : description.trim(),
      })
      setName('')
      setDescription('')
      onCreated(group)
    } catch (error) {
      const failure = describeCreateFailure(error)
      showErrors(failure.fieldErrors ?? {})
      setGeneral(failure.general ?? null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Crear un grupo" className="flex max-w-150 flex-col gap-4">
      <TextInput
        id={NAME_ID}
        ref={nameField}
        label="Nombre"
        value={name}
        maxLength={MAX_NAME + 50}
        placeholder="Por ejemplo, 'Repaso para el parcial 2' "
        error={fieldErrors.name}
        onChange={setName}
      />
      <TextInput
        id={DESCRIPTION_ID}
        ref={descriptionField}
        label="Descripción"
        optional
        multiline
        rows={4}
        value={description}
        maxLength={MAX_DESCRIPTION + 50}
        placeholder="Qué van a estudiar, cuándo se reúnen o qué esperan del grupo"
        hint={`Hasta ${MAX_DESCRIPTION} caracteres. El nombre y la descripción abren el hilo del grupo en el foro del curso.`}
        error={fieldErrors.description}
        onChange={setDescription}
      />
      {fieldErrors.courseId && <p className="text-label text-error">{fieldErrors.courseId}</p>}
      {general && (
        <p role="alert" className="text-label text-error">
          {general}
        </p>
      )}
      <div>
        <button type="submit" disabled={busy} className={buttonClasses('primary')}>
          {busy ? 'Creando…' : 'Crear grupo'}
        </button>
      </div>
    </form>
  )
}
