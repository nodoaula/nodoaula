/** Buscador del catálogo. La etiqueta, oculta, es también el texto de ejemplo. */
export default function SearchBox({ id, label, value, onChange }) {
  return (
    <div className="relative w-full sm:w-105" role="search">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-content-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`${label}…`}
        className="block w-full rounded-full border border-border-strong bg-surface-raised py-3 pr-4.5 pl-11 text-body text-content caret-accent placeholder:text-content-muted focus:border-accent focus:outline-none"
      />
    </div>
  )
}
