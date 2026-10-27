/**
 * Barra fina de progreso con su porcentaje, de 0 a 100: la de la descarga de
 * un apunte y la de su subida. Mide 160 px y crece si su fila tiene sitio.
 * `stopped` la apaga a gris cuando el progreso ya no avanzará.
 */
export default function ProgressBar({ value, label, stopped = false, className = '' }) {
  const fill = stopped
    ? '[&::-moz-progress-bar]:bg-content-faint [&::-webkit-progress-value]:bg-content-faint'
    : '[&::-moz-progress-bar]:bg-accent [&::-webkit-progress-value]:bg-accent'
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <progress
        value={value}
        max={100}
        aria-label={label}
        className={`h-1 w-40 grow appearance-none overflow-hidden rounded-full bg-surface-hover [&::-webkit-progress-bar]:bg-surface-hover ${fill}`}
      />
      <span aria-hidden="true" className="min-w-10 font-mono text-label text-content-muted tabular-nums">
        {value} %
      </span>
    </div>
  )
}
