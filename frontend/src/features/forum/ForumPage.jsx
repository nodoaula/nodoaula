import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import NodePath from '../../components/ui/NodePath.jsx'
import Notice from '../../components/ui/Notice.jsx'
import Tag from '../../components/ui/Tag.jsx'
import { useAnnouncer } from '../../components/ui/useAnnouncer.js'
import { useSession } from '../../session/useSession.js'
import { listResources } from '../catalog/api.js'
import { listQuestions } from './api.js'
import { formatAnswerCount, formatForumDate } from './format.js'
import QuestionForm from './QuestionForm.jsx'

/**
 * Foro de un curso (HU401): lista de preguntas, visible sin sesión, y
 * formulario para publicar, que se abre con «Hacer una pregunta». Sin sesión,
 * ese botón lleva a iniciarla y vuelve con `?preguntar`, que lo deja abierto. Cada pregunta enlaza a su
 * página, donde se responde y se retira (HU402). El autor no se muestra hasta
 * que exista el perfil público (HU506).
 */
export default function ForumPage() {
  const { courseId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const questionRetired = location.state?.questionRetired === true

  // Al volver de retirar una pregunta desde su página (HU402), el foro lo
  // confirma una vez: la marca sale del historial para que el aviso no vuelva
  // al recargar ni al volver atrás. Forum la conserva mientras siga montado.
  useEffect(() => {
    if (!questionRetired) return
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: null })
  }, [questionRetired, location.pathname, location.search, location.hash, navigate])

  return (
    <Forum
      key={courseId}
      courseId={courseId}
      questionRetired={questionRetired}
      askOnArrival={new URLSearchParams(location.search).has('preguntar')}
    />
  )
}

function Forum({ courseId, questionRetired: arrivedFromRetirement, askOnArrival }) {
  const [questionRetired] = useState(arrivedFromRetirement)
  const validId = /^\d+$/.test(courseId)
  const { account } = useSession()
  const { pathname } = useLocation()
  const [asking, setAsking] = useState(askOnArrival)
  const [announcement, announce] = useAnnouncer()
  const askButton = useRef(null)
  const closedByUser = useRef(false)

  // Al cerrar el formulario, el foco vuelve al botón que lo abrió: el que
  // tenía desaparece con el formulario.
  useEffect(() => {
    if (asking || !closedByUser.current) return
    closedByUser.current = false
    askButton.current?.focus()
  }, [asking])

  function closeForm() {
    closedByUser.current = true
    setAsking(false)
  }
  const [resources, setResources] = useState(validId ? null : [])
  const [questions, setQuestions] = useState(validId ? null : [])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!validId) return undefined
    let active = true

    Promise.all([listResources({ courseId }), listQuestions(courseId)])
      .then(([courseResources, courseQuestions]) => {
        if (!active) return
        setResources(courseResources)
        setQuestions(courseQuestions)
      })
      .catch((err) => {
        if (active) setError(err)
      })

    return () => {
      active = false
    }
  }, [courseId, validId])

  if (error) {
    return (
      <main className="mx-auto max-w-page px-4 pt-9 pb-18 sm:px-6">
        <Notice title="No se pudo cargar el foro" role="alert">
          Recarga la página para reintentar.
        </Notice>
      </main>
    )
  }

  if (resources === null || questions === null) {
    return (
      <main className="mx-auto max-w-page px-4 pt-9 pb-18 sm:px-6">
        <output className="block text-body text-content-muted">Cargando foro…</output>
      </main>
    )
  }

  // El listado solo incluye cursos con recursos: vacío es lo mismo que no encontrado.
  if (resources.length === 0) {
    return (
      <main className="mx-auto max-w-page px-4 pt-9 pb-18 sm:px-6">
        <Notice
          title="Curso no encontrado"
          action={
            <Link to="/catalogo" className={buttonClasses('secondary')}>
              Volver al catálogo
            </Link>
          }
        >
          Este curso no existe o ya no tiene recursos en el catálogo.
        </Notice>
      </main>
    )
  }

  const name = resources[0].course
  const formOpen = asking && account !== null

  return (
    <main className="mx-auto max-w-page px-4 pt-9 pb-18 sm:px-6">
      <NodePath
        label="Ubicación"
        items={[
          { label: 'Catálogo', to: '/catalogo' },
          { label: name, to: `/catalogo/cursos/${courseId}` },
        ]}
        current="Foro"
      />
      <div className="mt-5 flex max-w-[72ch] flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <h1 className="text-[1.875rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-display">
          Foro de {name}
        </h1>
        {!formOpen &&
          (account === null ? (
            // Vuelve al foro con el formulario abierto al iniciar sesión o
            // crear la cuenta (HU403).
            <Link to="/iniciar-sesion" state={{ from: `${pathname}?preguntar` }} className={buttonClasses('primary', 'lg')}>
              Hacer una pregunta
            </Link>
          ) : (
            <button ref={askButton} type="button" onClick={() => setAsking(true)} className={buttonClasses('primary', 'lg')}>
              Hacer una pregunta
            </button>
          ))}
      </div>

      {questionRetired && <RetiredQuestionNotice />}

      {formOpen && (
        <section aria-labelledby="ask-heading" className="mt-8 max-w-[72ch] rounded-2xl border border-border-strong p-6">
          <h2 id="ask-heading" className="mb-4 text-lead font-semibold text-content">
            Tu pregunta
          </h2>
          <QuestionForm
            courseId={courseId}
            resources={resources}
            onCancel={closeForm}
            onPublished={(question) => {
              setQuestions((current) => [question, ...current])
              closeForm()
              announce('Pregunta publicada.')
            }}
          />
        </section>
      )}
      <output className="sr-only">{announcement}</output>

      <QuestionList questions={questions} resources={resources} />
    </main>
  )
}

// Recibe el foco al llegar: el botón que se pulsó quedó en la página anterior.
function RetiredQuestionNotice() {
  const notice = useRef(null)
  useEffect(() => notice.current.focus(), [])
  return (
    <div ref={notice} tabIndex={-1} className="mt-6">
      <Notice title="Retiraste la pregunta">Ya no aparece en el foro del curso, ni sus respuestas.</Notice>
    </div>
  )
}

function QuestionList({ questions, resources }) {
  const resourceTitle = (id) => resources.find((resource) => resource.id === id)?.title

  return (
    <section aria-labelledby="questions-heading" className="mt-10">
      <h2 id="questions-heading" className="text-lead font-semibold text-content">
        Preguntas
      </h2>

      {questions.length === 0 ? (
        <p className="mt-3 text-body text-content-muted">Aún no hay preguntas en este curso. Sé la primera persona en preguntar.</p>
      ) : (
        <ul aria-label="Preguntas del curso" className="mt-3.5 max-w-[72ch] border-t border-border">
          {questions.map((question) => (
            <li key={question.id} className="border-b border-border">
              <QuestionRow question={question} resourceTitle={resourceTitle(question.resourceId)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function QuestionRow({ question, resourceTitle }) {
  return (
    <Link to={`/foro/preguntas/${question.id}`} className="group block px-1 py-4.5">
      <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <span className="min-w-0 text-[1.03125rem] leading-snug font-semibold wrap-break-word text-content transition-colors group-hover:text-accent">
          {question.title}
        </span>
        {/* El hilo de un grupo de estudio (HU404). */}
        {question.group && <Tag>Grupo</Tag>}
      </span>
      {question.body && (
        <span className="mt-1.5 line-clamp-2 text-body leading-relaxed wrap-break-word text-content-muted">{question.body}</span>
      )}
      <span className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-label text-content-muted tabular-nums">
        <span>{formatForumDate(question.createdAt)}</span>
        {resourceTitle && <span className="wrap-break-word">Sobre «{resourceTitle}»</span>}
        <span className={question.answerCount > 0 ? 'font-medium text-content' : undefined}>
          {question.answerCount === 0 ? 'Sin respuestas' : formatAnswerCount(question.answerCount)}
        </span>
      </span>
    </Link>
  )
}
