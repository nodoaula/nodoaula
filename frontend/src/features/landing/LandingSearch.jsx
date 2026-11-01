import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { CloseIcon } from '../../components/ui/icons.jsx'
import { useResourceSearch } from '../catalog/useResourceSearch.js'
import { rankResourceSuggestions, suggestCoursesAndTopics } from './landingCatalog.js'
import { prefersReducedMotion } from './useMediaQuery.js'

const EXAMPLE_INTERVAL_MS = 4500
const RESOURCE_SUGGESTIONS = 3

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

function resourceGroup(resources) {
  if (resources.every((resource) => resource.resourceType === 'DOCUMENT')) return 'Apuntes'
  if (resources.every((resource) => resource.resourceType === 'VIDEO')) return 'Videos'
  return 'Videos y apuntes'
}

function resourceOption(resource) {
  const note = resource.resourceType === 'DOCUMENT'
  return {
    key: `recurso-${resource.id}`,
    label: resource.title,
    meta: (note ? 'Apunte · ' : 'Video · ') + resource.course,
    dot: note ? 'size-2 bg-document' : 'size-2 bg-content-muted',
    resourceId: resource.id,
  }
}

function allResultsLabel(count) {
  const results = count === 1 ? 'Ver el resultado' : `Ver los ${count} resultados`
  return `${results} en el catálogo`
}

/**
 * Las opciones de la lista por grupos y, aparte, todas en el orden en que se
 * recorren con las flechas (`index`). Un curso o un tema llevan `pick`; un
 * recurso, `resourceId`; la última, `all`, abre el catálogo con lo escrito.
 */
function buildSuggestions(courses, topics, resources) {
  const groups = []
  const add = (label, options) => {
    if (options.length > 0) groups.push({ label, options })
  }
  add(
    'Cursos',
    courses.map((course) => ({
      key: `curso-${course.id}`,
      label: course.name,
      meta: plural(course.count, 'recurso', 'recursos'),
      dot: 'size-2.5 bg-content',
      pick: { course, topic: null },
    })),
  )
  add(
    'Temas',
    topics.map(({ name, course }) => ({ key: `tema-${course.id}-${name}`, label: name, meta: course.name, dot: 'size-2 bg-content-muted', pick: { course, topic: name } })),
  )
  if (resources.length > 0) add(resourceGroup(resources), resources.slice(0, RESOURCE_SUGGESTIONS).map(resourceOption))

  const options = groups.flatMap((group) => group.options)
  if (resources.length > 0) options.push({ key: 'todos', label: allResultsLabel(resources.length), all: true })
  options.forEach((option, index) => {
    option.index = index
  })
  return { groups, options }
}

/**
 * Buscador de la entrada, con el patrón «combobox» de ARIA: sugiere cursos y
 * temas al escribir, y videos y apuntes con la misma búsqueda del catálogo.
 * Escoger un curso o un tema lo escoge en la página; un recurso abre su
 * ficha; Enter sin opción marcada abre el catálogo con lo escrito.
 * `examples` son temas reales que el campo vacío va proponiendo.
 */
export default function LandingSearch({ summaries, examples, onPickCourse, onPickTopic, blurOnPick }) {
  const navigate = useNavigate()
  const search = useResourceSearch('')
  const inputRef = useRef(null)
  const inputId = useId()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [exampleIndex, setExampleIndex] = useState(0)

  const text = search.text.trim()
  const placeholders = ['Busca un tema o un curso', ...examples.map((example) => `Prueba «${example}»`)]

  // Solo mientras nadie lo usa: con el campo abierto, el ejemplo no cambia.
  const idle = !open && search.text === ''
  useEffect(() => {
    if (!idle || placeholders.length < 2 || prefersReducedMotion()) return undefined
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') setExampleIndex((index) => index + 1)
    }, EXAMPLE_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [idle, placeholders.length])

  const close = () => {
    setOpen(false)
    setActive(-1)
  }

  const { courses, topics } = suggestCoursesAndTopics(summaries, text)
  const resources = text && !search.pending && !search.error ? rankResourceSuggestions(search.resources, courses.map((course) => course.name)) : []
  const { groups, options } = buildSuggestions(courses, topics, resources)
  const showAll = () => navigate(`/catalogo?${new URLSearchParams({ q: text })}`)

  const activeIndex = active < options.length ? active : -1
  const listOpen = open && text !== '' && options.length > 0
  const nothingFound = open && text !== '' && options.length === 0 && !search.pending && !search.error
  const optionId = (index) => `${listId}-${index}`

  // Un curso o un tema se escoge en la página: el campo se vacía.
  const pickInPage = ({ course, topic }) => {
    if (topic) onPickTopic(course, topic)
    else onPickCourse(course)
    search.setText('')
    close()
    if (blurOnPick) inputRef.current.blur()
  }

  const choose = (option) => {
    setActive(-1)
    if (option.all) showAll()
    else if (option.resourceId) navigate(`/recursos/${option.resourceId}`)
    else pickInPage(option.pick)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && options.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActive((activeIndex + 1) % options.length)
    } else if (event.key === 'ArrowUp' && options.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActive(activeIndex <= 0 ? options.length - 1 : activeIndex - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (listOpen && activeIndex >= 0) choose(options[activeIndex])
      else if (text) showAll()
    } else if (event.key === 'Escape') {
      if (listOpen) close()
      else search.setText('')
    }
  }

  // Ir con Tab a «Borrar» o a «Ver todos los cursos» no cierra la lista.
  const handleBlur = (event) => {
    if (!event.currentTarget.closest('form').contains(event.relatedTarget)) close()
  }

  let announcement = ''
  if (text && options.length > 0) announcement = plural(options.length, 'sugerencia', 'sugerencias')
  else if (nothingFound) announcement = 'Sin sugerencias'

  return (
    <>
      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative mt-8 max-w-160">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="pointer-events-none absolute top-7 left-5 size-5 -translate-y-1/2 text-content-muted"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <label htmlFor={inputId} className="sr-only">
          Buscar cursos, temas, videos y apuntes
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck="false"
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-activedescendant={listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          placeholder={placeholders[exampleIndex % placeholders.length]}
          value={search.text}
          onChange={(event) => {
            search.setText(event.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="h-14 w-full rounded-full border border-border-control bg-surface-raised px-13 text-base text-content caret-accent transition-[border-color,box-shadow] duration-200 placeholder:text-content-muted hover:border-content-faint focus:border-accent focus:shadow-[0_0_0_4px_rgb(79_209_197/0.12)] focus:outline-none"
        />
        {text !== '' && (
          <button
            type="button"
            aria-label="Borrar la búsqueda"
            onClick={() => {
              search.setText('')
              close()
              inputRef.current.focus()
            }}
            onBlur={handleBlur}
            className="absolute top-7 right-2.5 grid size-9 -translate-y-1/2 place-items-center rounded-full text-content-muted after:absolute after:-inset-1 hover:bg-surface-hover hover:text-content"
          >
            <CloseIcon />
          </button>
        )}
        <ul
          id={listId}
          role="listbox"
          aria-label="Sugerencias"
          hidden={!listOpen}
          className="absolute inset-x-0 top-16 z-20 rounded-xl border border-border-strong bg-surface-raised p-1.5 shadow-[0_22px_48px_-16px_rgb(0_0_0/0.7)] motion-safe:animate-drop"
        >
          {groups.flatMap((group) => [
            <li key={group.label} role="presentation" className="px-3 pt-2.5 pb-1 text-label text-content-muted">
              {group.label}
            </li>,
            ...group.options.map(renderOption),
          ])}
          {options.at(-1)?.all && renderOption(options.at(-1))}
        </ul>
        {nothingFound && (
          <div className="absolute inset-x-0 top-16 z-20 rounded-xl border border-border-strong bg-surface-raised p-4 text-body leading-normal text-content-muted shadow-[0_22px_48px_-16px_rgb(0_0_0/0.7)] motion-safe:animate-drop">
            No encontramos nada con «{text}».{' '}
            <Link
              to="/catalogo"
              onMouseDown={(event) => event.preventDefault()}
              onBlur={handleBlur}
              className="mt-2 block font-medium text-content hover:underline hover:underline-offset-3"
            >
              Ver todos los cursos →
            </Link>
          </div>
        )}
      </form>
      <output htmlFor={inputId} className="sr-only">
        {announcement}
      </output>
    </>
  )

  function renderOption(option) {
    const on = option.index === activeIndex
    const tone = on ? 'text-content' : 'text-content-muted'
    const look = option.all ? `mt-1 rounded-t-none border-t border-border ${tone}` : 'text-content'
    return (
      <li
        key={option.key}
        id={optionId(option.index)}
        role="option"
        aria-selected={on}
        // Se elige al presionar y no al soltar: así el campo no pierde el foco
        // y la lista no se cierra antes de recibir el clic.
        onMouseDown={(event) => {
          event.preventDefault()
          choose(option)
        }}
        onMouseMove={() => setActive(option.index)}
        className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg px-3 py-2.5 text-body sm:flex-nowrap ${on ? 'bg-surface-hover' : ''} ${look}`}
      >
        <i aria-hidden="true" className={`flex-none rounded-full ${option.dot ?? 'invisible size-2'}`} />
        <span className="min-w-0 flex-1 truncate sm:flex-initial">{option.label}</span>
        {option.meta && (
          <small className="ml-5 basis-full font-mono text-label whitespace-nowrap text-content-muted sm:ml-auto sm:basis-auto">{option.meta}</small>
        )}
      </li>
    )
  }
}
