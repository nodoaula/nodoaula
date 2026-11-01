/**
 * Casilla de autorización del tratamiento de datos (HU510), con enlace a la
 * política. La comparten el registro y el paso en que una cuenta anterior
 * completa su perfil, que vuelve a pedirla porque la política cambió (HU506).
 */
export default function DataProcessingConsent({ id, checked, onChange, error }) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-start gap-3 text-sm text-content">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 size-4.5 shrink-0 scheme-dark accent-accent"
        />
        <span>
          Tengo 18 años o más y autorizo el tratamiento de mis datos personales según la{' '}
          <a
            href="/politica-de-datos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-3 hover:decoration-2"
          >
            política (se abre en otra pestaña)
          </a>
          .
        </span>
      </label>
      {error && (
        <p id={errorId} className="pl-7.5 text-label text-error">
          {error}
        </p>
      )}
    </div>
  )
}
