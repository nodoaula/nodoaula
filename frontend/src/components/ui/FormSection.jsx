import { useId } from 'react'

/**
 * Sección de un formulario: un título, una frase que dice qué se pide en ella
 * y sus campos. El título nombra la región para un lector de pantalla.
 */
export default function FormSection({ title, intro, children }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4">
      <div>
        <h2 id={headingId} className="text-lead font-semibold tracking-tight">{title}</h2>
        {intro && <p className="mt-1 text-sm text-content-muted">{intro}</p>}
      </div>
      {children}
    </section>
  )
}
