/**
 * Campo de texto con etiqueta, ayuda y error. Los atributos aria enlazan la
 * ayuda y el error con el campo, para que un lector de pantalla los lea al
 * entrar en él.
 *
 * `notice` es un aviso que se muestra dentro del campo mientras está vacío,
 * con un borde que lo distingue: como placeholder en los campos que lo
 * admiten, y superpuesto en los de fecha, que en la mayoría de navegadores no
 * muestran placeholder. El superpuesto deja pasar el clic y se oculta al
 * entrar en el campo, para no tapar lo que se escribe.
 */
export default function TextField({ id, label, hint, error, notice, ...inputProps }) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const noticeId = `${id}-notice`
  const describedBy = [hint && hintId, error && errorId, notice && noticeId].filter(Boolean).join(' ')

  const isEmpty = inputProps.value === undefined || inputProps.value === ''
  const overlayNotice = notice && inputProps.type === 'date' && isEmpty

  let stateClasses = 'border-slate-300 bg-white'
  if (error) stateClasses = 'border-red-500 bg-white'
  else if (notice) stateClasses = 'border-amber-500 bg-amber-50'

  const placeholder = notice && !overlayNotice ? notice : inputProps.placeholder

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`peer block w-full rounded-md border px-3 py-2 text-sm ${stateClasses}`}
          {...inputProps}
          placeholder={placeholder}
        />
        {overlayNotice && (
          <p
            id={noticeId}
            className="pointer-events-none absolute inset-y-px left-px right-10 flex items-center truncate rounded-l-md bg-amber-50 px-3 text-sm text-amber-800 peer-focus:hidden"
          >
            {notice}
          </p>
        )}
      </div>
      {notice && !overlayNotice && (
        <p id={noticeId} className="sr-only">
          {notice}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
