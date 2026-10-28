import { useState } from 'react'

import Modal from '../../components/ui/Modal.jsx'
import { formatAnswerCount, formatForumDate } from './format.js'
import { answerElementId, markButtonId, retireButtonId, THREAD_HEADING_ID, unmarkButtonId } from './threadIds.js'

// Acciones de texto subrayado: 24 px de alto como mínimo, para que se puedan
// pulsar en el celular aunque el texto sea pequeño.
const TEXT_ACTION = 'inline-flex min-h-6 items-center text-label underline underline-offset-4 disabled:opacity-60'
const ACCENT_ACTION = `${TEXT_ACTION} font-medium text-accent`
const QUIET_ACTION = `${TEXT_ACTION} text-content-muted hover:text-content`

function countHeading(count) {
  return count === 0 ? 'Respuestas' : formatAnswerCount(count)
}

/** El check de la respuesta útil, junto a su texto. */
export function UsefulMark({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-label font-medium text-accent">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
      </svg>
      {children}
    </span>
  )
}

/** El error de una acción, junto a ella. */
export function FailureMessage({ children }) {
  return (
    <p role="alert" className="mt-2 text-label text-error">
      {children}
    </p>
  )
}

/**
 * Hilo de respuestas de una pregunta (historia HU402), en orden cronológico.
 * `canMarkUseful` solo lo tiene quien hizo la pregunta; `busy` desactiva las
 * acciones mientras una está en curso.
 */
export default function AnswerThread({ answers, usefulAnswerId, canMarkUseful, signedIn, busy, failure, onMark, onUnmark, onRetire }) {
  const [confirming, setConfirming] = useState(null)

  function retire() {
    const answer = confirming
    setConfirming(null)
    onRetire(answer)
  }

  return (
    <section aria-labelledby={THREAD_HEADING_ID} className="mt-10">
      {/* tabIndex -1: recibe el foco cuando se retira la respuesta que lo tenía. */}
      <h2 id={THREAD_HEADING_ID} tabIndex={-1} className="border-b border-border pb-3 text-lead font-semibold text-content">
        {countHeading(answers.length)}
      </h2>

      {answers.length === 0 && (
        <p className="mt-3.5 text-body text-content-muted">
          {signedIn
            ? 'Todavía nadie responde. Si sabes la respuesta, o dónde está en el catálogo, escríbela abajo.'
            : 'Todavía nadie responde.'}
        </p>
      )}

      {answers.map((answer) => {
        const useful = answer.id === usefulAnswerId
        const date = formatForumDate(answer.createdAt)
        return (
          <article key={answer.id} id={answerElementId(answer.id)} tabIndex={-1} className="scroll-mt-6 border-b border-border py-5">
            <p className="text-body leading-relaxed whitespace-pre-line wrap-break-word text-content/80">{answer.body}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-mono text-label text-content-muted tabular-nums">
                {answer.mine ? `Tu respuesta · ${date}` : date}
              </span>
              {useful && <UsefulMark>Útil para quien preguntó</UsefulMark>}
              {canMarkUseful && !useful && (
                <button type="button" id={markButtonId(answer.id)} disabled={busy} onClick={() => onMark(answer.id)} className={ACCENT_ACTION}>
                  Marcar como útil
                </button>
              )}
              {canMarkUseful && useful && (
                <button type="button" id={unmarkButtonId(answer.id)} disabled={busy} onClick={() => onUnmark(answer.id)} className={QUIET_ACTION}>
                  Quitar la marca
                </button>
              )}
              {answer.canRetire && (
                <button type="button" id={retireButtonId(answer.id)} disabled={busy} onClick={() => setConfirming(answer)} className={`${QUIET_ACTION} ml-auto`}>
                  Retirar
                </button>
              )}
            </div>
            {failure?.target === answer.id && <FailureMessage>{failure.message}</FailureMessage>}
          </article>
        )
      })}

      <Modal
        open={confirming !== null}
        title="¿Retirar esta respuesta?"
        actions={[
          { label: 'Cancelar', onClick: () => setConfirming(null) },
          { label: 'Sí, retirar', onClick: retire, primary: true },
        ]}
      >
        <p className="text-sm text-slate-700">Dejará de verse en esta pregunta para todos.</p>
      </Modal>
    </section>
  )
}
