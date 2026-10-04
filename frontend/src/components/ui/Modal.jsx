import { useEffect, useId, useRef } from 'react'

const BUTTON_CLASSES = {
  primary:
    'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60',
  secondary:
    'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-500 hover:bg-slate-50',
}

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
 *        botones del pie, en orden; el principal recibe el foco al abrir
 */
export default function Modal({ open, title, children, actions }) {
  const dialogRef = useRef(null)
  const primaryRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) {
      dialog.showModal()
      primaryRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

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
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-md border border-slate-300 bg-white p-0 text-slate-900 shadow-lg backdrop:bg-slate-900/60"
    >
      <div className="flex max-h-[85vh] flex-col">
        <h2 id={titleId} className="border-b border-slate-200 px-5 py-4 text-lg font-semibold">
          {title}
        </h2>

        <div className="overflow-y-auto px-5 py-4">{children}</div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          {actions.map((action) => (
            <button
              key={action.label}
              ref={action.primary ? primaryRef : undefined}
              type="button"
              onClick={action.onClick}
              className={action.primary ? BUTTON_CLASSES.primary : BUTTON_CLASSES.secondary}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  )
}
