import { useEffect, useRef, useState } from 'react'

export const SECTION = 'pt-18 sm:pt-24'
export const SECTION_TITLE = 'text-[1.875rem] leading-[1.15] font-semibold tracking-[-0.025em] text-balance'

/**
 * Cada tarjeta se anima una vez, al verse casi entera, y otra vez al pasar el
 * ratón por encima. `replays[k]` cuenta las repeticiones, que se usan como
 * `key` para volver a montar el dibujo.
 */
function useReveal() {
  const ref = useRef(null)
  const [seen, setSeen] = useState({})
  const [replays, setReplays] = useState({})

  useEffect(() => {
    const reveal = (key) => setSeen((current) => ({ ...current, [key]: true }))
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries.filter((item) => item.isIntersecting)) {
          observer.unobserve(entry.target)
          reveal(entry.target.dataset.reveal)
        }
      },
      { threshold: 0.6 },
    )
    ref.current.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  // Pasar el ratón también la dibuja, aunque aún no se haya visto entera.
  const shown = (key) => Boolean(seen[key] || replays[key])
  const card = (key) => ({
    'data-reveal': key,
    onMouseEnter: () => setReplays((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 })),
  })
  return { ref, shown, replays, card }
}

// Antes de verse, el trazo está sin dibujar; con menos movimiento, siempre dibujado.
const drawn = (seen) => `[stroke-dasharray:1] ${seen ? 'motion-safe:animate-draw' : 'motion-safe:[stroke-dashoffset:1]'}`
const popped = (seen) => `[transform-box:fill-box] origin-center ${seen ? 'motion-safe:animate-pop' : 'motion-safe:scale-0'}`

function Check({ seen, delay, accent }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`mt-px size-5 ${accent ? 'text-accent' : 'text-content-muted'}`}>
      <path pathLength="1" d="m5 12.5 4.5 4.5L19 7.5" className={drawn(seen)} style={{ animationDuration: '0.45s', animationDelay: `${delay}ms` }} />
    </svg>
  )
}

const WITHOUT_ACCOUNT = [
  ['Buscar y filtrar por curso, tema y tipo', 'Escribe lo que necesitas o recorre tu curso tema por tema.'],
  ['Ver los videos', 'Con su duración, su curso y sus temas a la vista.'],
  ['Leer la vista previa de los apuntes', 'El 30 % de sus páginas.'],
]
const WITH_ACCOUNT = [
  ['Leer el apunte completo y descargarlo', 'En PDF, para estudiarlo aunque no tengas conexión.'],
  ['Preguntar y responder en el foro de cada curso', 'Quien pregunta marca la respuesta que le sirvió.'],
  ['Compartir un video o subir tus apuntes', 'Un video pegando su enlace; un apunte en PDF de hasta 20 MB.'],
]

/** Qué se hace sin cuenta y qué da una cuenta. Solo se muestra sin sesión. */
export function AccountSection() {
  const { ref, shown, replays, card } = useReveal()
  const boxes = [
    { key: 'sin', title: 'Sin cuenta', lead: 'Para consultar, basta con entrar.', items: WITHOUT_ACCOUNT },
    { key: 'con', title: 'Con una cuenta gratis, además', lead: 'Te registras en un minuto, sin pagar nada.', items: WITH_ACCOUNT, accent: true },
  ]

  return (
    <section ref={ref} aria-labelledby="entrada-cuenta" className={SECTION}>
      <h2 id="entrada-cuenta" className={SECTION_TITLE}>
        ¿Necesito una cuenta?
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
        {boxes.map((box, boxIndex) => {
          // La segunda caja empieza cuando termina la primera; al repetirse, cada una por su cuenta.
          const base = replays[box.key] ? 0 : boxIndex * 500
          return (
            <div key={box.key} {...card(box.key)} className={`rounded-2xl border p-6 sm:p-8 ${box.accent ? 'border-accent/35' : 'border-border-strong'}`}>
              <h3 className="mb-1.5 text-lead font-semibold tracking-[-0.02em]">{box.title}</h3>
              <p className="mb-5 text-body text-content-muted">{box.lead}</p>
              <ul key={replays[box.key] ?? 0} className="flex flex-col gap-3.5">
                {box.items.map(([title, detail], index) => (
                  <li key={title} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 text-base leading-[1.4]">
                    <Check seen={shown(box.key)} delay={base + index * 150} accent={box.accent} />
                    <span>
                      {title}
                      <small className="mt-0.5 block text-sm leading-[1.4] text-content-muted">{detail}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function VideoIcon({ seen, base }) {
  return (
    <>
      <rect pathLength="1" x="3" y="5" width="18" height="14" rx="3" className={drawn(seen)} style={{ animationDelay: `${base}ms` }} />
      <path d="m10 9.5 4.5 2.5-4.5 2.5z" className={popped(seen)} style={{ animationDelay: `${base + 550}ms` }} />
    </>
  )
}

function NoteIcon({ seen, base }) {
  const write = { animationDuration: '0.3s', animationTimingFunction: 'ease-out' }
  return (
    <>
      <path pathLength="1" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" className={drawn(seen)} style={{ animationDelay: `${base}ms` }} />
      <path pathLength="1" d="M14 3v5h5" className={drawn(seen)} style={{ animationDelay: `${base}ms` }} />
      <path pathLength="1" d="M9 13h6" className={drawn(seen)} style={{ ...write, animationDelay: `${base + 600}ms` }} />
      <path pathLength="1" d="M9 17h4" className={drawn(seen)} style={{ ...write, animationDelay: `${base + 850}ms` }} />
    </>
  )
}

function PathIcon({ seen, base }) {
  return (
    <>
      <path pathLength="1" d="M6 6l12 6-12 6" className={drawn(seen)} style={{ animationDelay: `${base}ms` }} />
      <circle cx="6" cy="6" r="2.5" fill="currentColor" className={popped(seen)} style={{ animationDelay: `${base}ms` }} />
      <circle cx="6" cy="18" r="2.5" fill="currentColor" className={popped(seen)} style={{ animationDelay: `${base + 650}ms` }} />
      <circle cx="18" cy="12" r="3" fill="currentColor" className={popped(seen)} style={{ animationDelay: `${base + 330}ms` }} />
    </>
  )
}

const SOURCES = [
  { key: 'videos', title: 'Videos', Icon: VideoIcon, text: 'No se copian: los de YouTube se ven aquí con su reproductor oficial, y los demás se abren donde se publicaron.' },
  { key: 'apuntes', title: 'Apuntes', Icon: NoteIcon, note: true, text: 'Los suben estudiantes en PDF y declaran que son suyos. Si uno infringe derechos de autor, se retira.' },
  { key: 'orden', title: 'Orden', Icon: PathIcon, text: 'Cada recurso va en su curso y en sus temas, elegidos de una lista común. Por eso un tema reúne todo lo suyo.' },
]

/** De dónde sale el contenido: videos ajenos sin copiar, apuntes de estudiantes, y el orden común. */
export function SourcesSection() {
  const { ref, shown, replays, card } = useReveal()

  return (
    <section ref={ref} aria-labelledby="entrada-origen" className={SECTION}>
      <h2 id="entrada-origen" className={SECTION_TITLE}>
        ¿De dónde sale el contenido?
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-6">
        {SOURCES.map(({ key, title, Icon, note, text }, index) => (
          <div
            key={key}
            {...card(key)}
            className="flex flex-col items-center justify-center rounded-2xl border border-border-strong bg-surface-raised px-6 py-7 text-center sm:px-8 sm:py-10"
          >
            <span aria-hidden="true" className={`grid size-16 place-items-center rounded-full bg-surface-hover ${note ? 'text-document' : 'text-accent'}`}>
              <svg key={replays[key] ?? 0} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-7">
                <Icon seen={shown(key)} base={replays[key] ? 0 : index * 250} />
              </svg>
            </span>
            <h3 className="mt-4 mb-2 text-xl leading-[normal] font-semibold tracking-[-0.02em] sm:mt-5.5 sm:mb-2.5">{title}</h3>
            <p className="m-0 max-w-[34ch] text-base leading-[1.6] text-pretty text-content-muted">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
