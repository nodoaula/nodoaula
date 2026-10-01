import { Link } from 'react-router'

import { SESSION_STATUS } from '../../session/SessionContext.js'
import { useLogout } from '../../session/useLogout.js'
import { useSession } from '../../session/useSession.js'
import CatalogPreview from './CatalogPreview.jsx'
import NodeGraph from './NodeGraph.jsx'

const PRIMARY_BUTTON =
  'inline-flex items-center rounded-full bg-accent font-semibold text-surface transition hover:-translate-y-px hover:shadow-[0_10px_30px_-10px_var(--color-accent)]'
const EYEBROW = 'font-mono text-xs text-accent'
const SECTION_TITLE = 'mt-3 max-w-[18ch] text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-[42px]'
const CARD = 'rounded-2xl border border-border bg-surface-raised p-7'

const STEPS = [
  {
    title: 'Busca por curso o por tema',
    text: 'Filtra por asignatura, tema o tipo de recurso, o escribe lo que recuerdas del título.',
  },
  {
    title: 'Mírala sin salir',
    text: 'Cada recurso tiene su ficha con el video, la duración, el canal y los temas que cubre.',
  },
  {
    title: 'Aporta el que te sirvió',
    text: 'Pega el enlace, elige el curso y el tema. Queda para quien venga después.',
  },
]

/**
 * Página de entrada: explica qué es NodoAula y para quién, y lleva al
 * catálogo y al registro. Accesible sin sesión iniciada. Va fuera de
 * AppLayout porque trae su propia cabecera.
 */
export default function LandingPage() {
  const { status, account } = useSession()
  const { loggingOut, logoutFailed, handleLogout } = useLogout()
  // Mientras no se sabe si hay sesión no se ofrece crear cuenta ni iniciarla,
  // para no enseñárselo a quien ya la tiene.
  const signedOut = status !== SESSION_STATUS.LOADING && account === null

  return (
    <div className="min-h-screen bg-surface text-content">
      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-64 h-[760px] bg-[radial-gradient(ellipse_60%_55%_at_70%_30%,color-mix(in_srgb,var(--color-accent)_20%,transparent),transparent_70%)]"
        />

        <header className="relative mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <Logo />
            NodoAula
          </Link>
          <nav className="flex items-center gap-3 text-sm whitespace-nowrap text-content-muted sm:gap-5">
            <Link to="/catalogo" className="hidden hover:text-content sm:block">
              Catálogo
            </Link>
            {signedOut && (
              <>
                <Link to="/iniciar-sesion" className="hover:text-content">
                  Iniciar sesión
                </Link>
                <Link to="/registro" className={`${PRIMARY_BUTTON} px-4 py-2`}>
                  Crear cuenta
                </Link>
              </>
            )}
            {account !== null && (
              <>
                {logoutFailed && (
                  <span className="text-red-400" role="alert">
                    No se pudo cerrar la sesión.
                  </span>
                )}
                <span className="hidden max-w-56 truncate md:block" title={account.email}>
                  {account.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="hover:text-content disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
                </button>
                <Link to="/registrar-recurso" className={`${PRIMARY_BUTTON} px-4 py-2`}>
                  Registrar recurso
                </Link>
              </>
            )}
          </nav>
        </header>

        <main>
          <section className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pt-7 pb-10 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:pt-14 lg:pb-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border-strong px-3 py-1 font-mono text-xs text-content-muted">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                Hecho por estudiantes de la UdeA
              </p>
              <h1 className="mt-5 text-[40px] leading-[1.02] font-semibold tracking-tighter text-balance sm:text-6xl lg:text-7xl">
                Cada tema, conectado con <span className="text-accent">su mejor clase</span>
              </h1>
              <p className="mt-5 max-w-[44ch] text-lg text-pretty text-content-muted">
                NodoAula es un catálogo de recursos de estudio organizado por curso y por tema. Llegas
                al video que necesitas en dos clics, no en veinte búsquedas.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/catalogo" className={`${PRIMARY_BUTTON} px-5 py-3 text-[15px]`}>
                  Explorar el catálogo →
                </Link>
                {signedOut && (
                  <Link
                    to="/registro"
                    className="inline-flex items-center rounded-full border border-border-strong px-5 py-3 text-[15px] font-medium hover:border-content-muted"
                  >
                    Crear cuenta
                  </Link>
                )}
              </div>
            </div>
            <NodeGraph />
          </section>

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <CatalogPreview />
          </div>

          <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
            <p className={EYEBROW}>Cómo funciona</p>
            <h2 className={SECTION_TITLE}>De la duda a la clase en tres pasos</h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className={CARD}>
                  <span
                    aria-hidden="true"
                    className="grid size-8.5 place-items-center rounded-full border border-border-strong font-mono text-xs text-accent"
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-7 text-[19px] font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-[15px] text-content-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
            <p className={EYEBROW}>Para quién es</p>
            <h2 className={SECTION_TITLE}>Para el que busca y para el que ya encontró</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className={CARD}>
                <h3 className="text-2xl font-semibold tracking-tight">Si estás estudiando</h3>
                <p className="mt-2 text-[15px] text-content-muted">
                  Consulta el catálogo sin crear cuenta. Todo está clasificado con los cursos y temas
                  de la carrera, no con los del algoritmo.
                </p>
                <Link to="/catalogo" className="mt-5 inline-block font-medium text-accent hover:underline">
                  Ir al catálogo →
                </Link>
              </div>
              <div
                className={`${CARD} border-accent/40 bg-[linear-gradient(140deg,color-mix(in_srgb,var(--color-accent)_20%,var(--color-surface-raised)),var(--color-surface-raised)_75%)]`}
              >
                <h3 className="text-2xl font-semibold tracking-tight">Si encontraste algo bueno</h3>
                <p className="mt-2 text-[15px] text-content-muted">
                  Crea una cuenta y regístralo. Un recurso bien catalogado le ahorra la búsqueda a todo
                  el semestre siguiente.
                </p>
                <Link
                  to={account === null ? '/registro' : '/registrar-recurso'}
                  className="mt-5 inline-block font-medium text-accent hover:underline"
                >
                  {account === null ? 'Crear cuenta →' : 'Registrar un recurso →'}
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>

      <footer className="mt-16 border-t border-border sm:mt-24">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-6 font-mono text-xs text-content-faint sm:px-6">
          <span>NodoAula · Proyecto Integrador I · Universidad de Antioquia</span>
          <span>2026</span>
        </div>
      </footer>
    </div>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-6">
      <path d="M5 5 19 12 5 19" className="stroke-border-strong" strokeWidth="2" />
      <circle cx="5" cy="5" r="3.5" className="fill-content" />
      <circle cx="5" cy="19" r="3.5" className="fill-content" />
      <circle cx="19" cy="12" r="4.5" className="fill-accent" />
    </svg>
  )
}
