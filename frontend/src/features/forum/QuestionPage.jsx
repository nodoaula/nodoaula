import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import Modal from '../../components/ui/Modal.jsx'
import NodePath from '../../components/ui/NodePath.jsx'
import Notice from '../../components/ui/Notice.jsx'
import { SESSION_STATUS } from '../../session/SessionContext.js'
import { useSession } from '../../session/useSession.js'
import { listResources } from '../catalog/api.js'
import AnswerForm from './AnswerForm.jsx'
import AnswerThread, { FailureMessage, UsefulMark } from './AnswerThread.jsx'
import {
  clearUsefulAnswer,
  getQuestion,
  listAnswers,
  markUsefulAnswer,
  retireAnswer,
  retireQuestion,
} from './api.js'
import { formatForumDate } from './format.js'
import { describeForumFailure } from './forumFailures.js'
import {
  answerElementId,
  markButtonId,
  RETIRE_QUESTION_BUTTON_ID,
  retireButtonId,
  THREAD_HEADING_ID,
  unmarkButtonId,
} from './threadIds.js'

// 404 si la pregunta no existe y 400 si la dirección no trae un número, como
// /foro/preguntas/abc. Para quien visita, las dos son lo mismo.
function isNotFound(error) {
  return error.code === 'QUESTION_NOT_FOUND' || error.status === 404 || error.status === 400
}

const forumPath = (courseId) => `/catalogo/cursos/${courseId}/foro`

const asRetired = (question) => ({ id: question.id, courseId: question.courseId, retired: true })

// Devuelve si la retiró esta petición: false si otra cuenta ya la había retirado.
async function retireQuestionIfStillThere(questionId) {
  try {
    await retireQuestion(questionId)
    return true
  } catch (error) {
    if (error.code !== 'QUESTION_NOT_FOUND') throw error
    return false
  }
}

// Las respuestas de la pregunta. Si la retiraron justo después de leerla, la
// pregunta se trata como retirada y no como inexistente.
async function withAnswers(question) {
  if (question.retired) return { question, answers: [] }
  try {
    return { question, answers: await listAnswers(question.id) }
  } catch (error) {
    if (error.code !== 'QUESTION_NOT_FOUND') throw error
    return { question: asRetired(question), answers: [] }
  }
}

// Si ya no existe, desaparece del hilo igual que si se hubiera retirado.
async function retireIfStillThere(answerId) {
  try {
    await retireAnswer(answerId)
  } catch (error) {
    if (error.code !== 'ANSWER_NOT_FOUND') throw error
  }
}

const withoutAnswer = (answerId) => (answers) => answers.filter(({ id }) => id !== answerId)

const withoutUsefulMark = (answerId) => (question) =>
  question.usefulAnswerId === answerId ? { ...question, usefulAnswerId: null } : question

/**
 * Página de una pregunta del foro (historia HU402): la pregunta, su hilo y
 * el formulario para responder. Se lee sin sesión.
 *
 * La key reinicia la carga cuando cambia la pregunta de la dirección.
 */
export default function QuestionPage() {
  const { questionId } = useParams()
  const { status, account } = useSession()

  // Lo que se ofrece depende de quién la ve: se espera a saber si hay sesión,
  // y se vuelve a cargar al iniciarla o cerrarla.
  if (status === SESSION_STATUS.LOADING) return <Loading />
  const viewer = account?.id ?? 'sin-sesion'
  return <QuestionLoader key={`${questionId}:${viewer}`} questionId={questionId} signedIn={account !== null} />
}

function Page({ children }) {
  return <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">{children}</main>
}

function Loading() {
  return (
    <Page>
      <output className="block text-body text-content-muted">Cargando pregunta…</output>
    </Page>
  )
}

function QuestionLoader({ questionId, signedIn }) {
  const [loaded, setLoaded] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    // El curso y el recurso relacionado salen de los recursos del curso: el
    // nombre del curso para la ruta y el foro, y el título del recurso.
    async function load() {
      const question = await getQuestion(questionId)
      const [thread, resources] = await Promise.all([withAnswers(question), listResources({ courseId: question.courseId })])
      return { ...thread, resources }
    }

    load()
      .then((data) => {
        if (active) setLoaded(data)
      })
      .catch((err) => {
        if (!active) return
        if (!isNotFound(err)) console.error('No se pudo cargar la pregunta', err)
        setError(err)
      })

    return () => {
      active = false
    }
  }, [questionId])

  let content
  if (error && isNotFound(error)) {
    content = (
      <Unavailable action={<Link to="/catalogo" className={buttonClasses('secondary')}>Volver al catálogo</Link>}>
        La dirección no corresponde a ninguna pregunta del foro.
      </Unavailable>
    )
  } else if (error) {
    content = (
      <Notice title="No se pudo cargar la pregunta" role="alert">
        Recarga la página para reintentar.
      </Notice>
    )
  } else if (loaded === null) {
    return <Loading />
  } else if (loaded.question.retired) {
    content = (
      <RetiredQuestion
        courseId={loaded.question.courseId}
        courseName={loaded.resources[0]?.course}
        takeFocus={loaded.retiredMeanwhile === true}
      />
    )
  } else {
    // Si otra cuenta la retira mientras se ve, la página pasa a decirlo.
    const retiredMeanwhile = () =>
      setLoaded((current) => ({ ...current, question: asRetired(current.question), retiredMeanwhile: true }))
    content = <Question {...loaded} signedIn={signedIn} onRetiredMeanwhile={retiredMeanwhile} />
  }

  return <Page>{content}</Page>
}

function Unavailable({ action, children }) {
  return (
    <Notice title="Esta pregunta ya no está disponible" action={action} titleLevel={1}>
      {children}
    </Notice>
  )
}

// `takeFocus` cuando aparece tras una acción en la misma página: el botón
// pulsado ya no existe.
function RetiredQuestion({ courseId, courseName, takeFocus }) {
  const notice = useRef(null)
  useEffect(() => {
    if (takeFocus) notice.current.focus()
  }, [takeFocus])

  return (
    <div ref={notice} tabIndex={-1}>
      <Unavailable
        action={
          <Link to={forumPath(courseId)} className={buttonClasses('secondary')}>
            {courseName ? `Volver al foro de ${courseName}` : 'Volver al foro del curso'}
          </Link>
        }
      >
        Quien la publicó, o el equipo de NodoAula, la retiró del foro.
      </Unavailable>
    </div>
  )
}

/**
 * Anuncia un cambio a los lectores de pantalla. Vacía la región antes de
 * escribir, para que un mismo texto se anuncie también dos veces seguidas.
 */
function useAnnouncer() {
  const [message, setMessage] = useState('')
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  function announce(text) {
    setMessage('')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(text), 100)
  }

  return [message, announce]
}

function Question({ question: initialQuestion, answers: initialAnswers, resources, signedIn, onRetiredMeanwhile }) {
  const navigate = useNavigate()
  const [question, setQuestion] = useState(initialQuestion)
  const [answers, setAnswers] = useState(initialAnswers)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const [confirmingRetirement, setConfirmingRetirement] = useState(false)
  const [announcement, announce] = useAnnouncer()
  const answerField = useRef(null)

  const courseName = resources[0]?.course
  const resource = resources.find(({ id }) => id === question.resourceId)
  const usefulAnswer = answers.find(({ id }) => id === question.usefulAnswerId)

  // Aplica el cambio de inmediato para poder llevar el foco al elemento que
  // lo muestra, que puede no existir antes del cambio. flushSync aplica
  // también el fin de `busy`: un botón desactivado no recibe el foco.
  function applyAndFocus(change, elementId, message) {
    flushSync(change)
    document.getElementById(elementId)?.focus()
    announce(message)
  }

  /**
   * Hace la petición con las acciones desactivadas. Si falla, el error se
   * muestra junto a la acción (`target` es la respuesta, o 'question') y el
   * foco vuelve al botón que se pulsó. Devuelve si salió bien.
   */
  async function run(request, { target, buttonId, fallback }) {
    setBusy(true)
    setFailure(null)
    try {
      await request()
    } catch (error) {
      console.error('No se pudo completar la acción en la pregunta', error)
      flushSync(() => {
        setBusy(false)
        setFailure({ target, message: describeForumFailure(error, fallback) })
      })
      document.getElementById(buttonId)?.focus()
      return false
    }
    setBusy(false)
    return true
  }

  // Tras un tiempo agotado no se sabe si la respuesta se guardó: se vuelve a
  // pedir el hilo para que se pueda comprobar sin perder el texto escrito.
  async function refreshThread() {
    try {
      setAnswers(await listAnswers(question.id))
    } catch (error) {
      console.error('No se pudo volver a cargar el hilo', error)
    }
  }

  function published(answer) {
    applyAndFocus(() => setAnswers((current) => [...current, answer]), answerElementId(answer.id), 'Publicaste tu respuesta.')
  }

  async function mark(answerId) {
    const done = await run(() => markUsefulAnswer(question.id, answerId), {
      target: answerId,
      buttonId: markButtonId(answerId),
      fallback: 'No se pudo marcar la respuesta. Recarga la página e intenta de nuevo.',
    })
    if (!done) return
    applyAndFocus(
      () => setQuestion((current) => ({ ...current, usefulAnswerId: answerId })),
      unmarkButtonId(answerId),
      'Marcaste la respuesta como útil.',
    )
  }

  async function unmark(answerId) {
    const done = await run(() => clearUsefulAnswer(question.id), {
      target: answerId,
      buttonId: unmarkButtonId(answerId),
      fallback: 'No se pudo quitar la marca. Intenta de nuevo.',
    })
    if (!done) return
    applyAndFocus(
      () => setQuestion((current) => ({ ...current, usefulAnswerId: null })),
      markButtonId(answerId),
      'Quitaste la marca de respuesta útil.',
    )
  }

  async function retire(answer) {
    const done = await run(() => retireIfStillThere(answer.id), {
      target: answer.id,
      buttonId: retireButtonId(answer.id),
      fallback: 'No se pudo retirar la respuesta. Intenta de nuevo.',
    })
    if (!done) return
    applyAndFocus(
      () => {
        setAnswers(withoutAnswer(answer.id))
        setQuestion(withoutUsefulMark(answer.id))
      },
      THREAD_HEADING_ID,
      answer.mine ? 'Retiraste tu respuesta.' : 'Retiraste la respuesta.',
    )
  }

  async function retireTheQuestion() {
    setConfirmingRetirement(false)
    let retiredHere = false
    const done = await run(async () => {
      retiredHere = await retireQuestionIfStillThere(question.id)
    }, {
      target: 'question',
      buttonId: RETIRE_QUESTION_BUTTON_ID,
      fallback: 'No se pudo retirar la pregunta. Intenta de nuevo.',
    })
    if (!done) return
    if (retiredHere) navigate(forumPath(question.courseId), { state: { questionRetired: true } })
    else onRetiredMeanwhile()
  }

  return (
    <>
      <NodePath
        label="Ubicación"
        items={[
          { label: 'Catálogo', to: '/catalogo' },
          ...(courseName ? [{ label: courseName, to: `/catalogo/cursos/${question.courseId}` }] : []),
          { label: 'Foro', to: forumPath(question.courseId) },
        ]}
        current="Pregunta"
      />

      {/* En el celular, una columna en el orden del código: título, datos,
          pregunta e hilo. En el computador los datos pasan a la derecha. */}
      <div className="mt-5.5 grid items-start gap-x-14 sm:grid-cols-[minmax(0,37.5rem)_17.5rem]">
        <h1 className="max-w-[24ch] text-[1.625rem] leading-[1.12] font-semibold tracking-tight text-balance wrap-break-word sm:col-start-1 sm:text-[2.125rem]">
          {question.title}
        </h1>

        <aside
          aria-label="Sobre esta pregunta"
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5 sm:sticky sm:top-6 sm:col-start-2 sm:row-span-3 sm:row-start-1 sm:mt-0 sm:flex-col sm:items-stretch sm:gap-4.5 sm:rounded-[1.125rem] sm:border sm:border-border sm:bg-surface-raised sm:p-5"
        >
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:grid sm:gap-3.5">
            <div>
              {/* La fecha se entiende sola en la franja del celular; el recurso no. */}
              <dt className="sr-only text-xs text-content-faint sm:not-sr-only">Publicada</dt>
              <dd className="font-mono text-label text-content tabular-nums sm:mt-1">{formatForumDate(question.createdAt)}</dd>
            </div>
            {resource && (
              <div className="flex items-baseline gap-x-1.5 sm:block">
                <dt className="shrink-0 text-label text-content-muted after:content-[':'] sm:text-xs sm:text-content-faint sm:after:content-none">
                  {resource.resourceType === 'VIDEO' ? 'Sobre el video' : 'Sobre el apunte'}
                </dt>
                <dd className="sm:mt-1">
                  <RelatedResource resource={resource} />
                </dd>
              </div>
            )}
          </dl>
          {signedIn && (
            <button type="button" onClick={() => answerField.current?.focus()} className={`${buttonClasses('secondary')} sm:self-start`}>
              Responder
            </button>
          )}
        </aside>

        <div className="sm:col-start-1">
          <p className="mt-5 max-w-150 text-body leading-relaxed whitespace-pre-line wrap-break-word text-content">{question.body}</p>

          {question.canRetire && (
            <div className="mt-3.5">
              <button
                type="button"
                id={RETIRE_QUESTION_BUTTON_ID}
                disabled={busy}
                onClick={() => setConfirmingRetirement(true)}
                className="inline-flex min-h-6 items-center text-label text-content-muted underline underline-offset-4 hover:text-content disabled:opacity-60"
              >
                Retirar pregunta
              </button>
              {failure?.target === 'question' && <FailureMessage>{failure.message}</FailureMessage>}
            </div>
          )}

          {usefulAnswer && <UsefulAnswerSummary answer={usefulAnswer} />}
        </div>

        <div className="sm:col-start-1">
          <AnswerThread
            answers={answers}
            usefulAnswerId={question.usefulAnswerId}
            canMarkUseful={question.canMarkUseful}
            signedIn={signedIn}
            busy={busy}
            failure={failure}
            onMark={mark}
            onUnmark={unmark}
            onRetire={retire}
          />

          {signedIn && (
            <AnswerForm questionId={question.id} onPublished={published} onTimedOut={refreshThread} fieldRef={answerField} />
          )}
          {!signedIn && <SignInToAnswer />}
        </div>
      </div>

      <output className="sr-only">{announcement}</output>

      <Modal
        open={confirmingRetirement}
        title="¿Retirar esta pregunta?"
        actions={[
          { label: 'Cancelar', onClick: () => setConfirmingRetirement(false) },
          { label: 'Sí, retirar', onClick: retireTheQuestion, primary: true },
        ]}
      >
        <p className="text-sm text-slate-700">Dejará de aparecer en el foro del curso para todos, con sus respuestas.</p>
      </Modal>
    </>
  )
}

function RelatedResource({ resource }) {
  const isVideo = resource.resourceType === 'VIDEO'
  return (
    <Link to={`/recursos/${resource.id}`} className="inline-flex items-baseline gap-2 text-sm text-content hover:text-accent">
      <span
        className={`rounded-full border px-2 font-mono text-caption ${
          isVideo ? 'border-accent/45 text-accent' : 'border-document/45 text-document'
        }`}
      >
        {isVideo ? 'Video' : 'PDF'}
      </span>
      <span className="wrap-break-word">{resource.title}</span>
    </Link>
  )
}

/** La respuesta útil repetida bajo la pregunta, con el enlace a su lugar en el hilo. */
function UsefulAnswerSummary({ answer }) {
  return (
    <section aria-labelledby="respuesta-util-titulo" className="mt-6 max-w-150 rounded-2xl border border-accent/35 bg-accent/5 p-4.5">
      <h2 id="respuesta-util-titulo" className="mb-2">
        <UsefulMark>Respuesta útil para quien preguntó</UsefulMark>
      </h2>
      {/* Recortada: la completa está en el hilo, a un enlace. */}
      <p className="line-clamp-6 text-body leading-relaxed whitespace-pre-line wrap-break-word text-content/80">{answer.body}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-label text-content-muted tabular-nums">{formatForumDate(answer.createdAt)}</span>
        <a href={`#${answerElementId(answer.id)}`} className="text-label font-medium text-accent underline underline-offset-4">
          Verla en el hilo
        </a>
      </div>
    </section>
  )
}

function SignInToAnswer() {
  const { pathname } = useLocation()
  const origin = { from: pathname }
  return (
    <div className="mt-8">
      <Notice
        title="Inicia sesión para responder"
        action={
          <div className="flex flex-wrap gap-3">
            <Link to="/iniciar-sesion" state={origin} className={buttonClasses('primary')}>
              Iniciar sesión
            </Link>
            <Link to="/registro" state={origin} className={buttonClasses('secondary')}>
              Crear cuenta
            </Link>
          </div>
        }
      >
        Puedes leer las respuestas sin cuenta; para responder necesitas iniciar sesión.
      </Notice>
    </div>
  )
}
