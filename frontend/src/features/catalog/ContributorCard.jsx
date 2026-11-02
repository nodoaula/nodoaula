import { initialOf } from '../account/profile.js'
import { describeContributor } from './contributor.js'
import { formatPublishedAt } from './format.js'

/**
 * Ficha de usuario de quien aportó un recurso (HU507), para valorar su
 * procedencia antes de usarlo. No es el perfil de la cuenta, que solo ve su
 * dueño, ni lleva a él: solo el nombre, el tipo de usuario, la institución y
 * el día del aporte, si se sabe. Lo del equipo lleva el acento de la
 * identidad; lo de la comunidad, el tono neutro.
 */
export default function ContributorCard({ contributor, contributedOn }) {
  const { team, name, details, origin } = describeContributor(contributor)

  return (
    <section
      aria-label="Quién lo aportó"
      className={`flex max-w-xl items-start gap-4 rounded-2xl border bg-surface-raised p-4 sm:p-5 ${
        team ? 'border-accent/45' : 'border-border'
      }`}
    >
      <Avatar team={team} name={contributor.name} />

      {/* min-w-0 y el corte de palabras evitan que un nombre o una institución
          larga desborden a 375 px. */}
      <div className="min-w-0">
        <p className="font-mono text-xs tracking-wider text-content-muted uppercase">Aportado por</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-body font-semibold wrap-break-word text-content">{name}</span>
          {origin && <OriginBadge team={team}>{origin}</OriginBadge>}
        </p>
        {details.length > 0 && (
          <p className="mt-0.5 text-label wrap-break-word text-content-muted">{details.join(' · ')}</p>
        )}
        {contributedOn && (
          <p className="mt-2 text-label text-content-muted">
            Aportado el <time dateTime={contributedOn}>{formatPublishedAt(contributedOn)}</time>
          </p>
        )}
      </div>
    </section>
  )
}

// La inicial del nombre, como en la cabecera. Sin nombre, la N de NodoAula
// para el equipo y una silueta para un miembro de la comunidad.
function Avatar({ team, name }) {
  const tone = team
    ? 'border-accent/45 bg-accent/15 text-accent'
    : 'border-border-strong bg-surface-hover text-content-muted'

  let content
  if (name != null) content = initialOf(name)
  else if (team) content = 'N'
  else content = <PersonIcon />

  return (
    <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full border font-semibold ${tone}`}>
      {content}
    </span>
  )
}

function OriginBadge({ team, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium ${
        team ? 'border-accent/45 text-accent' : 'border-border-strong text-content-muted'
      }`}
    >
      {children}
    </span>
  )
}

function PersonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-5"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" />
    </svg>
  )
}
