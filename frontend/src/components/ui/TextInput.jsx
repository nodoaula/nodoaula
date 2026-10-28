/**
 * Campo de texto de la identidad, de una línea o de varias, con su etiqueta,
 * una ayuda y el error. Los atributos aria enlazan la ayuda y el error con el
 * campo, para que un lector de pantalla los lea al entrar en él. `onChange`
 * recibe el valor, no el evento. `className` se suma a las clases del control.
 * `adornment` es un botón que va dentro del campo, a la derecha.
 */
export default function TextInput({ id, label, optional = false, multiline = false, hint, error, adornment, onChange, className = '', ...props }) {
  const Control = multiline ? 'textarea' : 'input'
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')
  const control = (
    <Control
      id={id}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy || undefined}
      className={`w-full rounded-xl border bg-surface-raised px-3.5 py-3 text-base text-content sm:text-body placeholder:text-content-faint focus:border-accent focus:outline-none ${multiline ? 'min-h-24 resize-y leading-normal' : ''} ${error ? 'border-error' : 'border-border-control hover:border-content-faint'} ${adornment ? 'pr-24' : ''} ${className}`}
      {...props}
    />
  )
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-content">
        {label} {optional && <span className="font-normal text-content-muted">opcional</span>}
      </label>
      {adornment ? (
        <div className="relative">
          {control}
          {adornment}
        </div>
      ) : (
        control
      )}
      {hint && <p id={`${id}-hint`} className="text-label text-content-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-label text-error">{error}</p>}
    </div>
  )
}
