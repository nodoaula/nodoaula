import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import SiteHeader from '../../app/SiteHeader.jsx'
import { buttonClasses } from '../../components/ui/button.js'
import { SESSION_STATUS } from '../../session/SessionContext.js'
import { useSession } from '../../session/useSession.js'
import { listCoursesWithResources, listResources } from '../catalog/api.js'
import { countText, formatCourseSummary, summarizeCourses } from '../catalog/courseSummary.js'
import ResourceRow from '../catalog/ResourceRow.jsx'
import CourseGraph, { NameAndCount } from './CourseGraph.jsx'
import { AccountSection, SECTION, SECTION_TITLE, SourcesSection } from './InfoSections.jsx'
import LandingSearch from './LandingSearch.jsx'
import { courseResources, graphRows, pickSample, searchExamples } from './landingCatalog.js'
import { prefersReducedMotion, useMediaQuery } from './useMediaQuery.js'

const SHOWN_COURSES = 5
const SHOWN_RESOURCES = 4
const TEXT_LINK = 'text-body font-medium text-content hover:underline hover:underline-offset-3'

function courseLink(courseId, topic) {
  const query = topic ? `?${new URLSearchParams({ topic })}` : ''
  return `/catalogo/cursos/${courseId}${query}`
}

/**
 * La lista de abajo: sin curso, la muestra del catálogo; con curso, sus
 * recursos o los de su tema. `goText` es el enlace que baja a ella desde la
 * gráfica.
 */
function describeResults({ featured, topic, summaries, resources }) {
  if (featured === null) {
    return {
      pool: pickSample(summaries, resources, SHOWN_RESOURCES),
      title: 'Una muestra del catálogo',
      note: `${countText(resources.length, 'recurso', 'recursos')} en ${countText(summaries.length, 'curso', 'cursos')}, y crece con cada aporte.`,
      moreLink: { to: '/catalogo', text: 'Ver todo el catálogo →' },
      goText: null,
    }
  }

  const pool = courseResources(resources, featured.name, topic)
  const scope = topic ?? featured.name
  const all = topic ? 'de este tema' : 'del curso'
  const open = topic ? 'el tema' : 'el curso'
  return {
    pool,
    title: topic ? `${featured.name}\u00a0· ${topic}` : featured.name,
    note: `${countText(pool.length, 'recurso', 'recursos')} ${topic ? 'en este tema' : 'en este curso'}`,
    moreLink: {
      to: courseLink(featured.id, topic),
      text: pool.length > SHOWN_RESOURCES ? `Ver los ${pool.length} ${all} →` : `Abrir ${open} →`,
    },
    goText: pool.length === 1 ? `Ver el recurso de ${scope}` : `Ver los ${pool.length} recursos de ${scope}`,
  }
}

/**
 * Página de entrada: qué es NodoAula, y buscar o escoger curso ahí mismo. Al
 * escoger un curso (en los botones, en la gráfica o en el buscador), la
 * gráfica pasa a sus temas y la lista de abajo a sus recursos; un tema los
 * filtra. Accesible sin sesión iniciada. Va fuera de AppLayout porque trae su
 * propia cabecera, sin borde, sobre el brillo de fondo.
 */
export default function LandingPage() {
  const { status, account } = useSession()
  // Mientras no se sabe si hay sesión no se ofrece crear cuenta ni aportar.
  const signedOut = status !== SESSION_STATUS.LOADING && account === null
  const signedIn = account !== null

  const [catalog, setCatalog] = useState({ state: 'loading', resources: [], summaries: [] })
  const [selection, setSelection] = useState({ course: null, topic: null, version: 0 })
  // En una sola columna la gráfica baja en vertical.
  const tree = useMediaQuery('(width < 1000px)')
  const graphRef = useRef(null)
  const resultsTitleRef = useRef(null)

  useEffect(() => {
    let active = true
    Promise.all([listResources(), listCoursesWithResources()])
      .then(([resources, courses]) => {
        if (active) setCatalog({ state: 'ready', resources, summaries: summarizeCourses(resources, courses) })
      })
      .catch((error) => {
        console.error('No se pudo cargar el catálogo de la página de entrada', error)
        if (active) setCatalog({ state: 'error', resources: [], summaries: [] })
      })
    return () => {
      active = false
    }
  }, [])

  const { resources, summaries } = catalog
  const ready = catalog.state === 'ready' && summaries.length > 0
  // Lo de abajo se pinta cuando el catálogo ya respondió, para que no salte al llegar.
  const settled = catalog.state !== 'loading'
  const featured = summaries.find((summary) => summary.id === selection.course) ?? null

  const select = (course, topic = null) => setSelection((current) => ({ course, topic, version: current.version + 1 }))
  const toggleTopic = (topic) => select(selection.course, selection.topic === topic ? null : topic)
  // Desde el buscador en una sola columna, la gráfica queda a la vista para ver el cambio.
  const selectAndShow = (course, topic) => {
    select(course, topic)
    if (tree) setTimeout(() => graphRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }), 50)
  }

  const shownCourses = [{ id: null, name: 'Todos los cursos', count: resources.length }, ...summaries.slice(0, SHOWN_COURSES)]
  const rows = graphRows(summaries, selection.course, selection.topic)
  // El nodo cuenta videos y apuntes, sin las horas de video del resumen del catálogo.
  const { videoCount, documentCount } = featured ?? summaries.reduce(
    (sum, summary) => ({ videoCount: sum.videoCount + summary.videoCount, documentCount: sum.documentCount + summary.documentCount }),
    { videoCount: 0, documentCount: 0 },
  )

  const { pool, title: resultsTitle, note: resultsNote, moreLink, goText } = describeResults({ featured, topic: selection.topic, summaries, resources })

  const goDown = () => {
    const title = resultsTitleRef.current
    title.closest('section').scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    title.focus({ preventScroll: true })
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-surface leading-[normal] text-content">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-260px] left-1/2 h-175 w-225 bg-[radial-gradient(closest-side,rgb(79_209_197/0.1),transparent_70%)]"
      />
      <div className="relative">
        <SiteHeader />
      </div>

      <main className="relative mx-auto max-w-page px-4 sm:px-6">
        <section
          aria-labelledby="entrada-titulo"
          className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-10 pt-8 pb-6 sm:pt-18 min-[1000px]:grid-cols-[minmax(0,1fr)_540px] min-[1000px]:gap-16"
        >
          <div>
            <h1 id="entrada-titulo" className="max-w-160 text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-[3rem]">
              Encuentra qué estudiar, <em className="text-accent not-italic">por curso y por tema</em>
            </h1>
            <p className="mt-4 max-w-[44ch] text-[1.0625rem] leading-[1.55] text-pretty text-content-muted sm:text-lg">
              NodoAula reúne en un solo lugar <b className="font-medium text-content">videos y apuntes de tus cursos</b>, ordenados
              por tema, para que no tengas que buscarlos por todas partes. Consultarlo es gratis.
            </p>

            <LandingSearch
              summaries={summaries}
              examples={searchExamples(summaries)}
              onPickCourse={(course) => selectAndShow(course.id)}
              onPickTopic={(course, topic) => selectAndShow(course.id, topic)}
              blurOnPick={tree}
            />

            {ready && (
              <>
                <p id="entrada-cursos" className="mt-8 mb-1.5 text-body text-content-muted sm:mt-11 sm:mb-4">
                  O escoge tu curso
                </p>
                <CourseButtons courses={shownCourses} selected={selection.course} onSelect={select} />
                <Link to="/catalogo" className={`mt-3 inline-block sm:mt-6 ${TEXT_LINK}`}>
                  Ver los demás cursos →
                </Link>
              </>
            )}
            {catalog.state === 'error' && (
              <p className="mt-8 max-w-160 text-body text-content-muted">
                No se pudieron cargar los cursos. Puedes buscar arriba, o recargar la página para verlos.
              </p>
            )}
          </div>

          {ready && (
            <div ref={graphRef} className="grid">
              <CourseGraph
                key={selection.version}
                label={featured ? featured.name : 'Todos los cursos'}
                detail={formatCourseSummary({ videoCount, documentCount })}
                to={featured ? courseLink(featured.id, selection.topic) : '/catalogo'}
                moreTo={featured ? courseLink(featured.id) : '/catalogo'}
                items={rows.items}
                more={rows.more}
                selected={selection}
                onPick={(item) => (featured ? toggleTopic(item.name) : select(item.courseId))}
                goText={goText}
                onGoDown={goDown}
                tree={tree}
              />
            </div>
          )}
        </section>

        {ready && (
          <section aria-labelledby="entrada-recursos" className={SECTION}>
            <div className="flex flex-wrap items-baseline justify-between gap-6">
              <div>
                <h2 id="entrada-recursos" ref={resultsTitleRef} tabIndex={-1} className={`outline-none ${SECTION_TITLE}`}>
                  {resultsTitle}
                </h2>
                <p className="mt-2 text-body text-content-muted">{resultsNote}</p>
              </div>
              <Link to={moreLink.to} className={`whitespace-nowrap ${TEXT_LINK}`}>
                {moreLink.text}
              </Link>
            </div>
            <ul key={selection.version} aria-label={resultsTitle} className="mt-6 border-t border-border leading-normal">
              {pool.slice(0, SHOWN_RESOURCES).map((resource, index) => (
                <li key={resource.id} className="border-b border-border motion-safe:animate-rise" style={{ animationDelay: `${index * 50}ms` }}>
                  <ResourceRow
                    resource={resource}
                    detail={(featured ? resource.topics.filter((topic) => topic !== selection.topic) : [resource.course, ...resource.topics]).join(' · ')}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {settled && (
          <>
            {signedOut && <AccountSection />}
            <SourcesSection />
            <ContributeInvite signedOut={signedOut} signedIn={signedIn} />
          </>
        )}
      </main>

      {settled && <LandingFooter />}
    </div>
  )
}

/**
 * «Todos los cursos» y los cursos con más recursos. En el celular van en una
 * fila que se desliza, y el escogido (también desde la gráfica o el buscador)
 * se desplaza a la vista.
 */
function CourseButtons({ courses, selected, onSelect }) {
  const listRef = useRef(null)

  useEffect(() => {
    const row = listRef.current
    const pressed = row.querySelector('[aria-pressed="true"]')
    if (!pressed || row.scrollWidth <= row.clientWidth) return
    const button = pressed.getBoundingClientRect()
    const bounds = row.getBoundingClientRect()
    if (button.left < bounds.left + 16 || button.right > bounds.right - 16) {
      row.scrollTo({ left: pressed.parentElement.offsetLeft - 16, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
  }, [selected])

  return (
    <ul
      ref={listRef}
      aria-labelledby="entrada-cursos"
      className="grid max-w-160 grid-cols-2 gap-x-5 gap-y-3.5 pl-2 max-sm:-mx-4 max-sm:flex max-sm:max-w-none max-sm:snap-x max-sm:snap-proximity max-sm:gap-2 max-sm:overflow-x-auto max-sm:px-4 max-sm:py-1.5 max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)] max-sm:[scroll-padding:0_1rem] max-sm:[scrollbar-width:none]"
    >
      {courses.map((course) => {
        const on = course.id === selected
        return (
          <li key={course.name} className="flex max-sm:flex-none max-sm:snap-start">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(course.id)}
              className={`relative flex min-h-14 w-full items-center justify-between gap-3 rounded-r-xl border border-l-0 py-2.5 pr-4 pl-4.5 text-left text-base leading-[normal] font-medium transition-[translate,color,background-color] duration-250 ease-arrive before:absolute before:-inset-y-px before:left-0 before:w-[3px] before:transition-colors motion-reduce:transition-none max-sm:min-h-11 max-sm:translate-x-0 max-sm:gap-2 max-sm:rounded-full max-sm:border-l max-sm:px-4 max-sm:text-body max-sm:whitespace-nowrap max-sm:before:hidden ${
                on
                  ? 'border-border-strong bg-surface-hover text-content -translate-x-2 before:bg-accent max-sm:border-accent motion-safe:before:animate-grow-y'
                  : 'border-border-strong bg-surface-raised text-content-muted before:bg-border-strong hover:-translate-x-[3px] hover:text-content max-sm:hover:translate-x-0'
              }`}
            >
              <NameAndCount name={course.name} count={course.count} countClassName="font-mono text-label font-normal text-content-muted" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** La invitación a aportar que cierra la página: sin sesión, a crear la cuenta. */
function ContributeInvite({ signedOut, signedIn }) {
  return (
    <section
      aria-labelledby="entrada-aporta"
      className="mt-18 flex flex-wrap items-center justify-between gap-8 rounded-2xl border border-accent/35 bg-surface-raised px-6 py-7 sm:mt-24 sm:p-14"
    >
      <div>
        <h2 id="entrada-aporta" className={SECTION_TITLE}>
          ¿Tienes apuntes que le sirvan a alguien más?
        </h2>
        <p className="mt-2.5 max-w-[52ch] text-base leading-normal text-pretty text-content-muted">
          Súbelos al curso y al tema que tocan. Con un video que te sirvió, basta con su enlace.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        {signedOut && (
          <>
            <Link to="/iniciar-sesion" state={{ from: '/' }} className={TEXT_LINK}>
              Ya tengo cuenta
            </Link>
            <Link to="/registro" state={{ from: '/' }} className={buttonClasses('primary', 'lg')}>
              Crear cuenta gratis
            </Link>
          </>
        )}
        {signedIn && (
          <>
            <Link to="/registrar-recurso" className={TEXT_LINK}>
              Compartir un video
            </Link>
            <Link to="/subir-apunte" className={buttonClasses('primary', 'lg')}>
              Subir un apunte
            </Link>
          </>
        )}
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="mt-18 border-t border-border">
      <div className="mx-auto flex max-w-page flex-wrap justify-between gap-3 px-4 py-5.5 font-mono text-label text-content-muted sm:px-6">
        <span>NodoAula · Proyecto Integrador I · Universidad de Antioquia</span>
        <span className="flex gap-4">
          <Link to="/politica-de-datos" className="hover:text-content">
            Política de datos
          </Link>
          <span>2026</span>
        </span>
      </div>
    </footer>
  )
}
