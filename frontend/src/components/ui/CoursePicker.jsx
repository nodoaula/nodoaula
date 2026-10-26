import { useRef, useState } from 'react'

import { normalizeText, tidyText } from '../../lib/text.js'
import Combobox from './Combobox.jsx'

const COURSE_MAX_LENGTH = 200

/**
 * Curso de una lista cerrada: se busca y se elige uno de los que existen, y
 * crear uno nuevo es una acción aparte, para que el catálogo no se llene de
 * cursos mal escritos. `value` es `{ id, name, isNew }` o null; un curso
 * nuevo aún no tiene `id`.
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
  const exact = courses.find((course) => normalizeText(course.name) === normalizedQuery)

  const choose = (course) => {
    setQuery('')
    onChange({ id: course.id, name: course.name, isNew: false })
  }

  const options = matches.map((course) => ({ key: course.id, label: course.name, onSelect: () => choose(course) }))
  if (typed !== '' && exact === undefined) {
    options.push({
      key: 'crear',
      label: `Crear el curso «${typed}»`,
      create: true,
      onSelect: () => {
        setQuery('')
        onChange({ name: typed, isNew: true })
      },
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-content">
        {label}
      </label>
      <Combobox
        id={id}
        inputRef={searchRef}
        value={query}
        onChange={setQuery}
        options={options}
        // Enter sin opción marcada elige el curso cuando no hay duda de cuál es.
        onEnter={() => {
          if (exact !== undefined) choose(exact)
          else if (matches.length === 1) choose(matches[0])
        }}
        maxLength={COURSE_MAX_LENGTH}
        placeholder="Busca el curso"
        invalid={Boolean(error)}
        aria-describedby={[hintId, error && errorId].filter(Boolean).join(' ')}
      />
      <p id={hintId} className="text-label text-content-muted">
        Elígelo de la lista. Si tu curso no está, escríbelo y pulsa «Crear el curso».
      </p>
      {error && <p id={errorId} className="text-label text-red-400">{error}</p>}
    </div>
  )
}
