/** Logotipo de tres nodos: dos cursos que llevan al nodo turquesa. */
export default function Logo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-6">
      <path d="M5 5 19 12 5 19" className="stroke-border-strong" strokeWidth="2" />
      <circle cx="5" cy="5" r="3.5" className="fill-content" />
      <circle cx="5" cy="19" r="3.5" className="fill-content" />
      <circle cx="19" cy="12" r="4.5" className="fill-accent" />
    </svg>
  )
}
