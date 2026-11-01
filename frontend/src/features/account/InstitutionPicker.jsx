import { useRef, useState } from 'react'

import Combobox from '../../components/ui/Combobox.jsx'
import { normalizeText } from '../../lib/text.js'

/**
 * Institución de una lista cerrada (HU506): se busca y se elige una de las
 * del SNIES, o «Otra», que no admite escribir una propia. Sin esto, «UdeA»,
 * «Universidad de Antioquia» y «udea» serían tres instituciones. «Otra» se
 * ofrece siempre, al final, aunque no coincida con lo que se busca.
 *
 * `institutions` es la lista de la API, `[{ id, name, other }]`, o null
 * mientras carga; `value` es una de ellas o null.
 */
export default function InstitutionPicker({ id, institutions, loadFailed = false, value, onChange, error }) {
  const [query, setQuery] = useState('')
  // Al pulsar «Cambiar» el buscador vuelve a aparecer, y el foco tiene que ir
  // a él para que el teclado no se quede sin sitio.
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
        <p className="text-sm font-medium text-content">Institución</p>
        <div className="flex items-center gap-3 rounded-xl border border-border-strong bg-surface-raised px-3.5 py-3 text-body text-content">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-accent" />
          <span className="min-w-0 break-words">{value.name}</span>
          <button
            type="button"
            onClick={() => {
              focusSearch.current = true
              onChange(null)
            }}
            className="ml-auto shrink-0 text-label font-medium text-accent underline underline-offset-4"
          >
            Cambiar{' '}<span className="sr-only">de institución</span>
          </button>
        </div>
        {error && <p id={errorId} className="text-label text-error">{error}</p>}
      </div>
    )
  }

  const normalizedQuery = normalizeText(query)
  const listed = institutions ?? []
  const matches = listed.filter((institution) => !institution.other && normalizeText(institution.name).includes(normalizedQuery))
  const other = listed.find((institution) => institution.other)

  const choose = (institution) => {
    setQuery('')
    onChange(institution)
  }

  const options = [...matches, ...(other ? [other] : [])].map((institution) => ({
    key: institution.id,
    label: institution.name,
    onSelect: () => choose(institution),
  }))

  let hint = 'Búscala por su nombre y elígela de la lista. Si no está, elige «Otra».'
  if (loadFailed) hint = 'No se pudo cargar la lista de instituciones. Recarga la página para intentarlo de nuevo.'
  else if (institutions === null) hint = 'Cargando la lista de instituciones…'

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-content">
        Institución
      </label>
      <Combobox
        id={id}
        inputRef={searchRef}
        value={query}
        onChange={setQuery}
        options={options}
        // Enter sin opción marcada elige la institución cuando no hay duda.
        onEnter={() => {
          if (matches.length === 1) choose(matches[0])
        }}
        placeholder="Busca tu institución"
        invalid={Boolean(error)}
        aria-describedby={[hintId, error && errorId].filter(Boolean).join(' ')}
      />
      <p id={hintId} className={`text-label ${loadFailed ? 'text-error' : 'text-content-muted'}`}>
        {hint}
      </p>
      {error && <p id={errorId} className="text-label text-error">{error}</p>}
    </div>
  )
}
