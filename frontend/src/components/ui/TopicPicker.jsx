import { useState } from 'react'

import { normalizeText, tidyText } from '../../lib/text.js'
import Combobox from './Combobox.jsx'
import { CloseIcon } from './icons.jsx'

/**
 * Temas de un recurso: los elegidos llevan una × para quitarlos, y los del
 * curso se ofrecen en la lista del campo, que se filtra al escribir. Los
 * nuevos se añaden de uno en uno: una coma no separa temas, es parte del
 * nombre que se escribe. Uno que solo se diferencia de otro en mayúsculas o
 * tildes se toma como ese otro, con su nombre de siempre.
 *
 * `suggestions` son los temas del curso; `value`, los elegidos.
 */
export default function TopicPicker({ id, label, suggestions, value, onChange, error }) {
  const [draft, setDraft] = useState('')
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const isChosen = (name) => value.some((topic) => normalizeText(topic) === normalizeText(name))
  const available = suggestions.filter((name) => !isChosen(name) && normalizeText(name).includes(normalizeText(draft)))

  const add = (raw) => {
    const typed = tidyText(raw)
    if (typed === '') return
    const known = [...suggestions, ...value].find((name) => normalizeText(name) === normalizeText(typed))
    const name = known ?? typed
    if (!value.includes(name)) onChange([...value, name])
    setDraft('')
  }

  const options = available.map((name) => ({ key: name, label: name, onSelect: () => add(name) }))
  const typed = tidyText(draft)
  const isKnown = [...suggestions, ...value].some((name) => normalizeText(name) === normalizeText(typed))
  if (typed !== '' && !isKnown) {
    options.push({
      key: 'nuevo',
      label: `Añadir el tema «${typed}»`,
      create: true,
      onSelect: () => add(typed),
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
          onEnter={() => add(draft)}
          placeholder="Escribe un tema"
          invalid={Boolean(error)}
          aria-describedby={[hintId, error && errorId].filter(Boolean).join(' ')}
        />
      </div>

      <p id={hintId} className="text-label text-content-muted">
        Elige de la lista los temas del curso o escribe uno nuevo y pulsa Enter. Se añaden de uno en uno.
      </p>
      {error && <p id={errorId} className="text-label text-red-400">{error}</p>}
    </fieldset>
  )
}
