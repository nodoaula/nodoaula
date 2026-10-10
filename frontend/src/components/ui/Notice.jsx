/**
 * Aviso dentro de una página: qué pasa y, si hay, qué hacer. `role` decide
 * cómo lo anuncia un lector de pantalla: "status" espera a que termine de
 * leer, "alert" interrumpe.
 */
export default function Notice({ title, children, action, role = 'status' }) {
  return (
    <div role={role} className="flex max-w-2xl gap-4 rounded-2xl border border-border-strong bg-surface-raised p-6">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-hover text-content-muted"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5v.01" />
        </svg>
      </span>
      <div>
        <h2 className="text-lead font-semibold tracking-tight text-content">{title}</h2>
        {children && <p className="mt-1.5 text-body text-content-muted">{children}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}
