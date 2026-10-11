import { useRef, useState } from 'react'

import { normalizeText, tidyText } from '../../lib/text.js'
import { PlusIcon } from './icons.jsx'

const MAX_MATCHES = 8
const COURSE_MAX_LENGTH = 200

/**
 * Curso de una lista cerrada: se busca y se elige uno de los que existen, y
 * crear uno nuevo es una acción aparte, para que el catálogo no se llene de
 * cursos mal escritos. `value` es `{ name, isNew }` o null.
 *
 * Los cursos que coinciden se muestran como botones y no como lista
 * desplegable: con botones nativos se llega a ellos con el teclado sin roles
 * ARIA ni manejo del foco.
 */
export default function CoursePicker({ id, label, courses, value, onChange, error }) {
  const [query, setQuery] = useState('')
  // Al pulsar «Cambiar» el campo de búsqueda vuelve a aparecer, y el foco
  // tiene que ir a él para que el teclado no se quede sin sitio.
  const focusSearch = useRef(false)
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const searchRef = (node) => {
    if (node !== null && focusSearch.current) {
      focusSearch.current = false
      node.focus()
    }
  }

  if (value !== null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-content">{label}</p>
        <div className="flex items-center gap-3 rounded-xl border border-border-strong bg-surface-raised px-3.5 py-3 text-body text-content">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-accent" />
          <span className="min-w-0 break-words">{value.name}</span>
          {value.isNew && (
            <span className="shrink-0 rounded-full border border-amber-300/40 px-2 py-0.5 font-mono text-caption text-amber-200">
              curso nuevo
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              focusSearch.current = true
              onChange(null)
            }}
            className="ml-auto shrink-0 text-label font-medium text-accent underline underline-offset-4"
          >
            Cambiar{' '}<span className="sr-only">de curso</span>
          </button>
        </div>
        {error && <p id={errorId} className="text-label text-red-400">{error}</p>}
      </div>
    )
  }

  const typed = tidyText(query)
  const normalizedQuery = normalizeText(query)
  const matches = courses
    .filter((course) => normalizeText(course.name).includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .slice(0, MAX_MATCHES)
  const exact = courses.find((course) => normalizeText(course.name) === normalizedQuery)
  const canCreate = typed !== '' && exact === undefined

  const choose = (course) => {
    setQuery('')
    onChange({ name: course.name, isNew: false })
  }

  // Enter elige el curso cuando no hay duda de cuál es; si no, no hace nada,
  // y en ningún caso envía el formulario.
  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (exact !== undefined) choose(exact)
    else if (matches.length === 1) choose(matches[0])
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-content">
        {label}
      </label>
      <input
        ref={searchRef}
        id={id}
        type="search"
        autoComplete="off"
        maxLength={COURSE_MAX_LENGTH}
        placeholder="Busca el curso"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, error && errorId].filter(Boolean).join(' ')}
        className={`w-full rounded-xl border bg-surface-raised px-3.5 py-3 text-body text-content placeholder:text-content-faint focus:border-accent focus:outline-none ${error ? 'border-red-400' : 'border-border-strong hover:border-content-faint'}`}
      />
      {(matches.length > 0 || canCreate) && (
        <ul aria-label="Cursos" className="flex flex-wrap gap-2">
          {matches.map((course) => (
            <li key={course.id}>
              <button
                type="button"
                onClick={() => choose(course)}
                className="rounded-full border border-border-strong px-3 py-1.5 text-label text-content hover:border-content-muted"
              >
                {course.name}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  onChange({ name: typed, isNew: true })
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-accent/60 px-3 py-1.5 text-label text-accent hover:border-accent"
              >
                <PlusIcon />
                Crear el curso «{typed}»
              </button>
            </li>
          )}
        </ul>
      )}
      <p id={hintId} className="text-label text-content-muted">
        Elígelo de la lista. Si tu curso no está, escríbelo y pulsa «Crear el curso».
      </p>
      {error && <p id={errorId} className="text-label text-red-400">{error}</p>}
    </div>
  )
}
