const EDGE = 'stroke-border-strong stroke-[1.5]'
// Las líneas resaltadas avanzan salvo para quien pide menos movimiento en su
// sistema: ahí quedan punteadas y quietas.
const ACTIVE_EDGE = 'stroke-accent stroke-[1.5] [stroke-dasharray:5_6] motion-safe:animate-dash-flow'
const CAPTION = 'fill-content-faint font-mono text-caption'
const LABEL = 'fill-content text-label font-medium'

/** Ilustración fija de la idea del sitio: un curso lleva a sus temas, y cada tema a sus recursos. */
export default function NodeGraph() {
  return (
    <svg
      viewBox="0 0 540 380"
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label="Un curso se conecta con sus temas, y cada tema con sus recursos"
    >
      <line className={EDGE} x1="70" y1="190" x2="230" y2="80" />
      <line className={ACTIVE_EDGE} x1="70" y1="190" x2="230" y2="190" />
      <line className={EDGE} x1="70" y1="190" x2="230" y2="300" />
      <line className={EDGE} x1="230" y1="80" x2="380" y2="54" />
      <line className={ACTIVE_EDGE} x1="230" y1="190" x2="380" y2="155" />
      <line className={ACTIVE_EDGE} x1="230" y1="190" x2="380" y2="240" />
      <line className={EDGE} x1="230" y1="300" x2="380" y2="326" />

      <circle className="fill-content" cx="70" cy="190" r="24" />
      <text className={CAPTION} x="70" y="238" textAnchor="middle">
        curso
      </text>
      <text className={LABEL} x="70" y="256" textAnchor="middle">
        Arquitectura
      </text>

      <circle className="fill-border-strong" cx="230" cy="80" r="11" />
      <circle className="fill-border-strong" cx="230" cy="300" r="11" />
      <circle className="fill-accent opacity-15" cx="230" cy="190" r="30" />
      <circle className="fill-accent" cx="230" cy="190" r="15" />
      <text className={LABEL} x="230" y="236" textAnchor="middle">
        Spring Boot
      </text>
      <text className={CAPTION} x="230" y="252" textAnchor="middle">
        tema
      </text>

      <rect className="fill-surface-raised stroke-border-strong opacity-55" x="380" y="38" width="140" height="32" rx="8" />
      <text className={CAPTION} x="393" y="58">
        Git y GitHub
      </text>
      <rect className="fill-surface-raised stroke-accent" x="380" y="136" width="156" height="38" rx="9" />
      <text className={LABEL} x="393" y="160">
        Spring Boot 2026-2
      </text>
      <rect className="fill-surface-raised stroke-accent" x="380" y="221" width="156" height="38" rx="9" />
      <text className={LABEL} x="393" y="245">
        Tutorial de Spring…
      </text>
      <rect className="fill-surface-raised stroke-border-strong opacity-55" x="380" y="310" width="140" height="32" rx="8" />
      <text className={CAPTION} x="393" y="330">
        Azure DevOps
      </text>
    </svg>
  )
}
