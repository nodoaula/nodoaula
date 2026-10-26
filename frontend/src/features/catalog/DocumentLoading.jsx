/**
 * Mientras se descarga el visor o el propio apunte (historia HU411). Con
 * `progress`, de 0 a 100, muestra cuánto del PDF ha llegado. La fila del
 * progreso ocupa su sitio desde el principio para que nada salte al aparecer.
 */
export default function DocumentLoading({ progress = null }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-raised px-6 py-14 text-center">
      <output className="text-body text-content-muted">Cargando el apunte…</output>
      <div className={`flex items-center gap-3 ${progress === null ? 'invisible' : ''}`}>
        <progress
          value={progress ?? 0}
          max={100}
          aria-label="Descarga del apunte"
          className="h-1 w-40 appearance-none overflow-hidden rounded-full bg-surface-hover [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-surface-hover [&::-webkit-progress-value]:bg-accent"
        />
        <span aria-hidden="true" className="min-w-10 font-mono text-label text-content-muted tabular-nums">
          {progress ?? 0} %
        </span>
      </div>
    </div>
  )
}
