/**
 * Campo de texto de la identidad, de una línea o de varias, con su etiqueta,
 * una ayuda y el error. Los atributos aria enlazan la ayuda y el error con el
 * campo, para que un lector de pantalla los lea al entrar en él. `onChange`
 * recibe el valor, no el evento. `className` se suma a las clases del control.
 * `adornment` es un botón que va dentro del campo, a la derecha.
 *
 * `notice` es un aviso que se muestra dentro del campo mientras está vacío,
 * con un borde ámbar que lo distingue: como placeholder en los campos que lo
 * admiten, y superpuesto en los de fecha, que en la mayoría de navegadores no
 * muestran placeholder. El superpuesto deja pasar el clic y se oculta al
 * entrar en el campo, para no tapar lo que se escribe.
 */
export default function TextInput({ id, label, optional = false, multiline = false, hint, error, notice, adornment, onChange, className = '', ...props }) {
  const Control = multiline ? 'textarea' : 'input'
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`, notice && `${id}-notice`].filter(Boolean).join(' ')
  const isEmpty = props.value === undefined || props.value === ''
  const overlayNotice = notice && props.type === 'date' && isEmpty
  let stateClasses = 'border-border-control hover:border-content-faint'
  if (error) stateClasses = 'border-error'
  else if (notice) stateClasses = 'border-document'
  const control = (
    <Control
      id={id}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy || undefined}
      className={`peer w-full rounded-xl border bg-surface-raised px-3.5 py-3 text-base text-content sm:text-body placeholder:text-content-faint focus:border-accent focus:outline-none ${multiline ? 'min-h-24 resize-y leading-normal' : ''} ${stateClasses} ${adornment ? 'pr-24' : ''} ${className}`}
      {...props}
      placeholder={notice && !overlayNotice ? notice : props.placeholder}
    />
  )
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-content">
        {label} {optional && <span className="font-normal text-content-muted">opcional</span>}
      </label>
      {adornment || notice ? (
        <div className="relative">
          {control}
          {adornment}
          {overlayNotice && (
            <p
              id={`${id}-notice`}
              className="pointer-events-none absolute inset-y-px left-px right-10 flex items-center truncate rounded-l-xl bg-surface-raised px-3.5 text-base text-document sm:text-body peer-focus:hidden"
            >
              {notice}
            </p>
          )}
        </div>
      ) : (
        control
      )}
      {notice && !overlayNotice && <p id={`${id}-notice`} className="sr-only">{notice}</p>}
      {hint && <p id={`${id}-hint`} className="text-label text-content-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-label text-error">{error}</p>}
    </div>
  )
}
