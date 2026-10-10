/** Etiqueta en píldora, como los temas de un recurso. */
export default function Tag({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border-strong px-3 py-1 text-label text-content">
      {children}
    </span>
  )
}
