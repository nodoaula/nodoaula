import { useEffect, useId, useState } from 'react'

import { PlusIcon } from './icons.jsx'

function nextIndex(current, count) {
  return count === 0 ? -1 : (current + 1) % count
}

function previousIndex(current, count) {
  if (count === 0) return -1
  return current <= 0 ? count - 1 : current - 1
}

/**
 * Campo de texto con lista desplegable de opciones, según el patrón
 * «combobox» de la guía de prácticas de ARIA: el foco se queda en el campo,
 * las flechas recorren la lista y un lector de pantalla anuncia la opción
 * marcada por aria-activedescendant. Enter elige la opción marcada; si no hay
 * ninguna, llama a `onEnter`. Escape cierra la lista.
 *
 * `options` son `{ key, label, onSelect, create }`; las que crean algo nuevo
 * llevan `create` y se dibujan con un +.
 */
export default function Combobox({ id, value, onChange, options, onEnter, inputRef, invalid, ...inputProps }) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const activeIndex = active < options.length ? active : -1
  const showList = open && options.length > 0
  const optionId = (index) => `${listId}-${index}`

  // La opción marcada con el teclado se mantiene a la vista en listas largas.
  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' })
  })

  const select = (option) => {
    setActive(-1)
    option.onSelect()
  }

  const handleKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setOpen(true)
        setActive(nextIndex(activeIndex, options.length))
        break
      case 'ArrowUp':
        event.preventDefault()
        setOpen(true)
        setActive(previousIndex(activeIndex, options.length))
        break
      case 'Enter':
        // Nunca envía el formulario: elegir una opción no es publicar.
        event.preventDefault()
        if (showList && activeIndex >= 0) select(options[activeIndex])
        else onEnter?.()
        break
      case 'Escape':
        if (showList) {
          event.preventDefault()
          setOpen(false)
          setActive(-1)
        }
        break
      default:
        break
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-invalid={invalid ? true : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
        }}
        onKeyDown={handleKeyDown}
        className={`w-full rounded-xl border bg-surface-raised px-3.5 py-3 text-body text-content placeholder:text-content-faint focus:border-accent focus:outline-none ${invalid ? 'border-red-400' : 'border-border-strong hover:border-content-faint'}`}
        {...inputProps}
      />
      <ul
        id={listId}
        role="listbox"
        hidden={!showList}
        className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-30 max-h-64 overflow-y-auto rounded-xl border border-border-strong bg-surface-raised p-1.5 shadow-[0_22px_48px_-16px_rgb(0_0_0/0.7)]"
      >
        {options.map((option, index) => (
          <li
            key={option.key}
            id={optionId(index)}
            role="option"
            aria-selected={index === activeIndex}
            // Se elige al presionar y no al soltar: así el campo no pierde el
            // foco, y la lista no se cierra antes de recibir el clic.
            onMouseDown={(event) => {
              event.preventDefault()
              select(option)
            }}
            onMouseMove={() => setActive(index)}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-body ${option.create ? 'text-accent' : 'text-content'} ${index === activeIndex ? 'bg-surface-hover' : ''} ${option.create && index > 0 ? 'mt-1 border-t border-border' : ''}`}
          >
            {option.create && <PlusIcon />}
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
