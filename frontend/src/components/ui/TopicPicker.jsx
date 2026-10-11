import { useState } from 'react'

import { normalizeText, tidyText } from '../../lib/text.js'
import Combobox from './Combobox.jsx'
import { CloseIcon } from './icons.jsx'

/**
 * Temas de un recurso: los elegidos llevan una × para quitarlos, y los del
 * curso se ofrecen en la lista del campo, que se filtra al escribir. También se
 * escriben, de uno en uno o varios separados por comas. Uno que solo se diferencia de otro en
 * mayúsculas o tildes se toma como ese otro, con su nombre de siempre.
 *
 * `suggestions` son los temas del curso; `value`, los elegidos.
 */
export default function TopicPicker({ id, label, suggestions, value, onChange, error }) {
  const [draft, setDraft] = useState('')
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const isChosen = (name) => value.some((topic) => normalizeText(topic) === normalizeText(name))
  // Se filtra por lo último que se está escribiendo, después de la última coma.
  const segments = draft.split(',')
  const typing = segments.at(-1)
  const available = suggestions.filter((name) => !isChosen(name) && normalizeText(name).includes(normalizeText(typing)))

  const add = (names) => {
    const next = [...value]
    for (const raw of names) {
      const typed = tidyText(raw)
      if (typed === '') continue
      const known = [...suggestions, ...next].find((name) => normalizeText(name) === normalizeText(typed))
      const name = known ?? typed
      if (!next.includes(name)) next.push(name)
    }
    onChange(next)
    setDraft('')
  }

  // Elegir una sugerencia añade también lo escrito antes de la última coma.
  const options = available.map((name) => ({ key: name, label: name, onSelect: () => add([...segments.slice(0, -1), name]) }))
  // Lo escrito se añade entero: la etiqueta nombra todos los temas que añade.
  const typed = segments.map(tidyText).filter((name) => name !== '')
  const lastIsKnown = [...suggestions, ...value].some((name) => normalizeText(name) === normalizeText(typing))
  if (typed.length > 0 && (typed.length > 1 || !lastIsKnown)) {
    const quoted = typed.map((name) => `«${name}»`).join(', ')
    options.push({
      key: 'nuevo',
      label: typed.length === 1 ? `Añadir el tema ${quoted}` : `Añadir los temas ${quoted}`,
      create: true,
      onSelect: () => add(segments),
    })
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-2 text-sm font-medium text-content">
        {label} <span className="font-normal text-content-muted">al menos uno</span>
      </legend>

      {value.length > 0 && (
        <ul aria-label="Temas elegidos" className="flex flex-wrap gap-2">
          {value.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent/10 py-1 pr-1 pl-3.5 text-label text-content"
            >
              {name}
              <button
                type="button"
                onClick={() => onChange(value.filter((topic) => topic !== name))}
                aria-label={`Quitar el tema ${name}`}
                className="grid size-7 place-items-center rounded-full text-content-muted hover:bg-content/10 hover:text-content max-sm:size-9"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor={id} className="sr-only">
          Escribe un tema
        </label>
        <Combobox
          id={id}
          value={draft}
          onChange={setDraft}
          options={options}
          onEnter={() => add(segments)}
          placeholder="Escribe un tema"
          invalid={Boolean(error)}
          aria-describedby={[hintId, error && errorId].filter(Boolean).join(' ')}
        />
      </div>

      <p id={hintId} className="text-label text-content-muted">
        Elige de la lista los temas del curso o escribe uno nuevo y pulsa Enter. Puedes escribir varios separados por comas.
      </p>
      {error && <p id={errorId} className="text-label text-red-400">{error}</p>}
    </fieldset>
  )
}
