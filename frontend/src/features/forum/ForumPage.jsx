import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import Modal from '../../components/ui/Modal.jsx'
import NodePath from '../../components/ui/NodePath.jsx'
import Notice from '../../components/ui/Notice.jsx'
import { useSession } from '../../session/useSession.js'
import { listResources } from '../catalog/api.js'
import { listQuestions, retireQuestion } from './api.js'
import QuestionForm from './QuestionForm.jsx'

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })

/**
 * Foro de un curso (HU401): lista de preguntas, visible sin sesión, y
 * formulario para publicar con sesión iniciada. El autor no se muestra hasta
 * que exista el perfil público (HU506).
 */
export default function ForumPage() {
  const { courseId } = useParams()
  return <Forum key={courseId} courseId={courseId} />
}

function Forum({ courseId }) {
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

      <QuestionList
        questions={questions}
        resources={resources}
        onRetired={(id) => setQuestions((current) => current.filter((question) => question.id !== id))}
      />
    </main>
  )
}

function QuestionList({ questions, resources, onRetired }) {
  const resourceTitle = (id) => resources.find((resource) => resource.id === id)?.title

  return (
    <section aria-labelledby="questions-heading" className="mt-10">
      <h2 id="questions-heading" className="text-lead font-semibold text-content">
        Preguntas
      </h2>

      {questions.length === 0 ? (
        <p className="mt-3 text-body text-content-muted">Aún no hay preguntas en este curso. Sé la primera persona en preguntar.</p>
      ) : (
        <ul aria-label="Preguntas del curso" className="mt-3 border-t border-border">
          {questions.map((question) => (
            <li key={question.id} className="border-b border-border py-4">
              <QuestionItem question={question} resourceTitle={resourceTitle(question.resourceId)} onRetired={onRetired} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function retireErrorMessage(error) {
  if (error.code === 'QUESTION_CHANGE_FORBIDDEN') {
    return 'Solo quien publicó esta pregunta o una cuenta del equipo puede retirarla.'
  }
  if (error.code === 'QUESTION_NOT_FOUND') return 'Esta pregunta ya no está disponible.'
  if (error.code === 'CSRF_TOKEN_INVALID') return 'La página caducó. Recárgala e intenta de nuevo.'
  if (error.status === 401) return 'Tu sesión terminó. Inicia sesión de nuevo.'
  return 'No se pudo retirar la pregunta. Intenta de nuevo.'
}

function QuestionItem({ question, resourceTitle, onRetired }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)

  async function retire() {
    setConfirming(false)
    setBusy(true)
    setFailure(null)
    try {
      await retireQuestion(question.id)
      onRetired(question.id)
    } catch (error) {
      // Si ya no existe, desaparece de la lista igual que si se hubiera retirado.
      if (error.code === 'QUESTION_NOT_FOUND') onRetired(question.id)
      else {
        setFailure(retireErrorMessage(error))
        setBusy(false)
      }
    }
  }

  return (
    <article>
      <h3 className="text-body font-semibold wrap-break-word text-content">{question.title}</h3>
      <p className="mt-1 font-mono text-label text-content-muted">
        {dateFormat.format(new Date(question.createdAt))}
        {resourceTitle && <> · Sobre «{resourceTitle}»</>}
      </p>
      <p className="mt-2 text-body whitespace-pre-line wrap-break-word text-content-muted">{question.body}</p>

      {failure && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {failure}
        </p>
      )}

      {question.canRetire && (
        <div className="mt-3">
          <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={buttonClasses('secondary')}>
            {busy ? 'Retirando…' : 'Retirar'}
          </button>
          <Modal
            open={confirming}
            title="¿Retirar esta pregunta?"
            actions={[
              { label: 'Cancelar', onClick: () => setConfirming(false) },
              { label: 'Sí, retirar', onClick: retire, primary: true },
            ]}
          >
            <p className="text-sm text-slate-700">Dejará de aparecer en el foro del curso para todos.</p>
          </Modal>
        </div>
      )}
    </article>
  )
}
