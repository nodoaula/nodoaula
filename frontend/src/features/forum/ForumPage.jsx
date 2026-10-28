import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import NodePath from '../../components/ui/NodePath.jsx'
import Notice from '../../components/ui/Notice.jsx'
import { useSession } from '../../session/useSession.js'
import { listResources } from '../catalog/api.js'
import { listQuestions } from './api.js'
import { formatForumDate } from './format.js'
import QuestionForm from './QuestionForm.jsx'

/**
 * Foro de un curso (HU401): lista de preguntas, visible sin sesión, y
 * formulario para publicar con sesión iniciada. Cada pregunta enlaza a su
 * página, donde se responde y se retira (HU402). El autor no se muestra hasta
 * que exista el perfil público (HU506).
 */
export default function ForumPage() {
  const { courseId } = useParams()
  // Al volver de retirar una pregunta desde su página (HU402), el foro lo confirma.
  const questionRetired = useLocation().state?.questionRetired === true
  return <Forum key={courseId} courseId={courseId} questionRetired={questionRetired} />
}

function Forum({ courseId, questionRetired }) {
  const validId = /^\d+$/.test(courseId)
  const { account } = useSession()
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
      <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
        <Notice title="No se pudo cargar el foro" role="alert">
          Recarga la página para reintentar.
        </Notice>
      </main>
    )
  }

  if (resources === null || questions === null) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
        <output className="block text-body text-content-muted">Cargando foro…</output>
      </main>
    )
  }

  // El listado solo incluye cursos con recursos: vacío es lo mismo que no encontrado.
  if (resources.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
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

  return (
    <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
      <NodePath
        label="Ubicación"
        items={[
          { label: 'Catálogo', to: '/catalogo' },
          { label: name, to: `/catalogo/cursos/${courseId}` },
        ]}
        current="Foro"
      />
      <h1 className="mt-5 text-[1.875rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-display">
        Foro de {name}
      </h1>

      {questionRetired && <RetiredQuestionNotice />}

      <section aria-labelledby="ask-heading" className="mt-8">
        <h2 id="ask-heading" className="mb-4 text-lead font-semibold text-content">
          Haz una pregunta
        </h2>
        {account === null ? (
          <Notice
            title="Inicia sesión para preguntar"
            action={
              <div className="flex flex-wrap gap-3">
                <Link to="/iniciar-sesion" className={buttonClasses('primary')}>
                  Iniciar sesión
                </Link>
                <Link to="/registro" className={buttonClasses('secondary')}>
                  Crear cuenta
                </Link>
              </div>
            }
          >
            Puedes leer las preguntas sin cuenta; para publicar una necesitas iniciar sesión.
          </Notice>
        ) : (
          <QuestionForm
            courseId={courseId}
            resources={resources}
            onPublished={(question) => setQuestions((current) => [question, ...current])}
          />
        )}
      </section>

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

function answerCountText(count) {
  if (count === 0) return 'Sin respuestas'
  return count === 1 ? '1 respuesta' : `${count} respuestas`
}

function QuestionRow({ question, resourceTitle }) {
  return (
    <Link to={`/foro/preguntas/${question.id}`} className="group block px-1 py-4.5">
      <span className="block text-[1.03125rem] leading-snug font-semibold wrap-break-word text-content transition-colors group-hover:text-accent">
        {question.title}
      </span>
      <span className="mt-1.5 line-clamp-2 text-body leading-relaxed wrap-break-word text-content-muted">{question.body}</span>
      <span className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-label text-content-muted tabular-nums">
        <span>{formatForumDate(question.createdAt)}</span>
        {resourceTitle && <span className="wrap-break-word">Sobre «{resourceTitle}»</span>}
        <span className={question.answerCount > 0 ? 'font-medium text-content' : undefined}>
          {answerCountText(question.answerCount)}
        </span>
      </span>
    </Link>
  )
}
