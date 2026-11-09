import { useEffect, useId, useRef } from 'react'

import { buttonClasses } from './button.js'

// Escape dispara cancel; cancelarlo deja la ventana abierta.
function preventCancel(event) {
  event.preventDefault()
}

/**
 * Ventana modal sobre el elemento nativo <dialog>, abierto con showModal():
 * el navegador vuelve inerte la página de fondo, mantiene el foco dentro del
 * recuadro y dibuja el fondo (::backdrop).
 *
 * Solo se cierra con sus botones. Un clic fuera del recuadro no la cierra,
 * que es lo que hace showModal() por defecto, y Escape tampoco: se cancela el
 * evento cancel. Algunos navegadores dejan de permitir cancelarlo si se pulsa
 * Escape dos veces seguidas; si aun así se cierra, se vuelve a abrir, porque
 * quien manda es `open`.
 *
 * @param {boolean} open si la ventana está abierta
 * @param {string} title título, que también la nombra para un lector de pantalla
 * @param {Array<{label: string, onClick: Function, primary?: boolean}>} actions
 *        botones del pie, en orden. El foco empieza en el primero que no es el
 *        principal: confirmaciones como retirar no se deshacen, y un Enter sin
 *        querer no debe aceptarlas.
 */
export default function Modal({ open, title, children, actions }) {
  const dialogRef = useRef(null)
  const safeRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) {
      dialog.showModal()
      safeRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const safeIndex = Math.max(
    actions.findIndex((action) => !action.primary),
    0,
  )

  function handleClose() {
    if (open) dialogRef.current.showModal()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      closedby="none"
      onCancel={preventCancel}
      onClose={handleClose}
      className="m-auto w-[calc(100%-2rem)] max-w-110 rounded-2xl border border-border-strong bg-surface-raised p-0 text-content shadow-[0_24px_60px_-20px_rgb(0_0_0/0.85)] backdrop:bg-[rgb(5_7_13/0.72)]"
    >
      <div className="flex max-h-[85vh] flex-col p-6">
        <h2 id={titleId} className="text-lead font-semibold tracking-tight">
          {title}
        </h2>

        <div className="mt-2 overflow-y-auto text-body leading-relaxed text-content-muted">{children}</div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {actions.map((action, index) => (
            <button
              key={action.label}
              ref={index === safeIndex ? safeRef : undefined}
              type="button"
              onClick={action.onClick}
              className={buttonClasses(action.primary ? 'primary' : 'secondary')}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  )
}
