import { USER_TYPES } from './profile.js'

/**
 * Tipo de usuario (HU506): dos opciones, «Estudiante» o «Docente», como
 * botones de radio dentro de un fieldset, para que un lector de pantalla las
 * anuncie como un grupo con su pregunta. El error marca la primera opción, a
 * donde va el foco tras un envío rechazado.
 */
export default function UserTypeField({ id, value, onChange, error }) {
  const errorId = `${id}-error`
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 text-sm font-medium text-content">Soy</legend>
      <div className="grid grid-cols-2 gap-3">
        {USER_TYPES.map((type, index) => (
          <label
            key={type.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-surface-raised px-3.5 py-3 text-body text-content has-checked:border-accent has-checked:bg-accent/10 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-accent ${error ? 'border-error' : 'border-border-control hover:border-content-faint'}`}
          >
            <input
              id={index === 0 ? id : undefined}
              type="radio"
              name={id}
              value={type.value}
              checked={value === type.value}
              onChange={() => onChange(type.value)}
              aria-invalid={error && index === 0 ? true : undefined}
              className="size-4.5 shrink-0 scheme-dark accent-accent focus-visible:outline-none"
            />
            {type.label}
          </label>
        ))}
      </div>
      {error && <p id={errorId} className="text-label text-error">{error}</p>}
    </fieldset>
  )
}
