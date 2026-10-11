import { useState } from 'react'

import { normalizeText, tidyText } from '../../lib/text.js'
import { CloseIcon, PlusIcon } from './icons.jsx'

/**
 * Temas de un recurso: los elegidos llevan una × para quitarlos, y los del
 * curso se ofrecen para añadirlos con un clic. También se escriben, de uno en
 * uno o varios separados por comas. Uno que solo se diferencia de otro en
 * mayúsculas o tildes se toma como ese otro, con su nombre de siempre.
 *
 * `suggestions` son los temas del curso; `value`, los elegidos.
 */
export default function TopicPicker({ id, label, courseName, suggestions, value, onChange, error }) {
  const [draft, setDraft] = useState('')
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const isChosen = (name) => value.some((topic) => normalizeText(topic) === normalizeText(name))
  // Se filtra por lo último que se está escribiendo, después de la última coma.
  const typing = normalizeText(draft.split(',').pop())
  const available = suggestions.filter((name) => !isChosen(name) && normalizeText(name).includes(typing))

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
  }

  const addDraft = () => {
    add(draft.split(','))
    setDraft('')
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

      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          Escribe un tema
        </label>
        <input
          id={id}
          type="text"
          autoComplete="off"
          placeholder="Escribe un tema, o varios separados por comas"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            addDraft()
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, error && errorId].filter(Boolean).join(' ')}
          className={`min-w-0 flex-1 rounded-full border bg-surface-raised px-4 py-2.5 text-body text-content placeholder:text-content-faint focus:border-accent focus:outline-none ${error ? 'border-red-400' : 'border-border-strong hover:border-content-faint'}`}
        />
        <button
          type="button"
          onClick={addDraft}
          className="shrink-0 rounded-full border border-border-strong px-4 text-sm font-medium text-content hover:border-content-muted"
        >
          Añadir
        </button>
      </div>

      {available.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-label text-content-muted">
            {typing ? `Coinciden en ${courseName}:` : `Temas de ${courseName}:`}
          </p>
          <ul className="flex flex-wrap gap-2">
            {available.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => add([name])}
                  aria-label={`Añadir el tema ${name}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-label text-content hover:border-content-muted"
                >
                  <PlusIcon />
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p id={hintId} className="text-label text-content-muted">
        Los temas que escribas y aún no existan se crean al publicar.
      </p>
      {error && <p id={errorId} className="text-label text-red-400">{error}</p>}
    </fieldset>
  )
}
