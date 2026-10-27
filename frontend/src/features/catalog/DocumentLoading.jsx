import ProgressBar from '../../components/ui/ProgressBar.jsx'

/**
 * Mientras se descarga el visor o el propio apunte (historia HU411). Con
 * `progress`, de 0 a 100, muestra cuánto del PDF ha llegado. La fila del
 * progreso ocupa su sitio desde el principio para que nada salte al aparecer.
 */
export default function DocumentLoading({ progress = null }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-raised px-6 py-14 text-center">
      <output className="text-body text-content-muted">Cargando el apunte…</output>
      <ProgressBar value={progress ?? 0} label="Descarga del apunte" className={progress === null ? 'invisible' : ''} />
    </div>
  )
}
