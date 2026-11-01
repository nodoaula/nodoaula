import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import Modal from '../../components/ui/Modal.jsx'
import NodePath from '../../components/ui/NodePath.jsx'
import Notice from '../../components/ui/Notice.jsx'
import Tag from '../../components/ui/Tag.jsx'
import { useAnnouncer } from '../../components/ui/useAnnouncer.js'
import { SESSION_STATUS } from '../../session/SessionContext.js'
import { useSession } from '../../session/useSession.js'
import { listResources } from '../catalog/api.js'
import { formatForumDate } from '../forum/format.js'
import { listGroups, retireGroup } from './api.js'
import StudyGroupForm from './StudyGroupForm.jsx'

const LIST_HEADING_ID = 'grupos-titulo'
const groupElementId = (groupId) => `grupo-${groupId}`
const retireButtonId = (groupId) => `retirar-grupo-${groupId}`

const FAILURES = {
  STUDY_GROUP_CHANGE_FORBIDDEN: 'Solo quien creó este grupo o una cuenta del equipo puede retirarlo.',
  CSRF_TOKEN_INVALID: 'La página caducó. Recárgala e intenta de nuevo.',
}

function describeRetireFailure(error) {
  if (FAILURES[error.code]) return FAILURES[error.code]
  if (error.status === 401) return 'Tu sesión terminó. Inicia sesión de nuevo.'
  if (error.timedOut) return 'El servidor tardó demasiado. Recarga la página para ver si se retiró.'
  return 'No se pudo retirar el grupo. Intenta de nuevo.'
}

// Si otra cuenta ya lo había retirado, desaparece de la lista igual.
async function retireIfStillThere(groupId) {
  try {
    await retireGroup(groupId)
  } catch (error) {
    if (error.code !== 'STUDY_GROUP_NOT_FOUND') throw error
  }
}

/**
 * Grupos de estudio de un curso (historia HU404), con la maqueta aprobada
 * (opción A, como el foro del curso): el formulario para crear un grupo
 * arriba, con sesión iniciada, y la lista debajo, visible sin sesión. Cada
 * grupo enlaza a su hilo en el foro del curso.
 *
 * Lo que se ofrece depende de quién lo ve: se espera a saber si hay sesión,
 * y la key vuelve a cargar al cambiar el curso o la sesión.
 */
export default function StudyGroupsPage() {
  const { courseId } = useParams()
  const { status, account } = useSession()
  if (status === SESSION_STATUS.LOADING) return <Loading />
  const viewer = account?.id ?? 'sin-sesion'
  return <StudyGroups key={`${courseId}:${viewer}`} courseId={courseId} signedIn={account !== null} />
}

function Page({ children }) {
  return <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">{children}</main>
}

function Loading() {
  return (
    <Page>
      <output className="block text-body text-content-muted">Cargando grupos…</output>
    </Page>
  )
}

function StudyGroups({ courseId, signedIn }) {
  // Una dirección que no es un número no puede ser un curso: no se pregunta.
  const validId = /^\d+$/.test(courseId)
  const [resources, setResources] = useState(validId ? null : [])
  const [groups, setGroups] = useState(validId ? null : [])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!validId) return undefined
    let active = true

    Promise.all([listResources({ courseId }), listGroups(courseId)])
      .then(([courseResources, courseGroups]) => {
        if (!active) return
        setResources(courseResources)
        setGroups(courseGroups)
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
      <Page>
        <Notice title="No se pudieron cargar los grupos" role="alert">
          Recarga la página para reintentar.
        </Notice>
      </Page>
    )
  }

  if (resources === null || groups === null) return <Loading />

  // El listado solo incluye cursos con recursos: vacío es lo mismo que no encontrado.
  if (resources.length === 0) {
    return (
      <Page>
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
      </Page>
    )
  }

  return (
    <Page>
      <CourseGroups courseId={courseId} courseName={resources[0].course} initialGroups={groups} signedIn={signedIn} />
    </Page>
  )
}

function CourseGroups({ courseId, courseName, initialGroups, signedIn }) {
  const [groups, setGroups] = useState(initialGroups)
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const [announcement, announce] = useAnnouncer()

  // Aplica el cambio de inmediato para poder llevar el foco al elemento que
  // lo muestra, que no existe antes del cambio.
  function applyAndFocus(change, elementId, message) {
    flushSync(change)
    document.getElementById(elementId)?.focus()
    announce(message)
  }

  function created(group) {
    applyAndFocus(() => setGroups((current) => [group, ...current]), groupElementId(group.id), `Creaste el grupo ${group.name}.`)
  }

  async function retire() {
    const group = confirming
    setConfirming(null)
    setBusy(true)
    setFailure(null)
    try {
      await retireIfStillThere(group.id)
    } catch (error) {
      console.error('No se pudo retirar el grupo', error)
      flushSync(() => {
        setBusy(false)
        setFailure({ groupId: group.id, message: describeRetireFailure(error) })
      })
      document.getElementById(retireButtonId(group.id))?.focus()
      return
    }
    applyAndFocus(
      () => {
        setBusy(false)
        setGroups((current) => current.filter(({ id }) => id !== group.id))
      },
      LIST_HEADING_ID,
      `Retiraste el grupo ${group.name}.`,
    )
  }

  return (
    <>
      <NodePath
        label="Ubicación"
        items={[
          { label: 'Catálogo', to: '/catalogo' },
          { label: courseName, to: `/catalogo/cursos/${courseId}` },
        ]}
        current="Grupos"
      />
      <h1 className="mt-5 text-[1.875rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-display">
        Grupos de {courseName}
      </h1>
      <p className="mt-2.5 max-w-[60ch] text-body text-content-muted">
        Organízate con quienes van en la misma materia. Cada grupo conversa en su propio hilo del foro del curso.
      </p>

      <section aria-labelledby="crear-grupo-titulo" className="mt-8">
        <h2 id="crear-grupo-titulo" className="mb-4 text-lead font-semibold text-content">
          Crea un grupo
        </h2>
        {signedIn ? <StudyGroupForm courseId={courseId} onCreated={created} /> : <SignInToCreate />}
      </section>

      <GroupList groups={groups} busy={busy} failure={failure} onRetire={setConfirming} />

      <output className="sr-only">{announcement}</output>

      <Modal
        open={confirming !== null}
        title="¿Retirar este grupo?"
        actions={[
          { label: 'Cancelar', onClick: () => setConfirming(null) },
          { label: 'Sí, retirar', onClick: retire, primary: true },
        ]}
      >
        <p className="text-sm text-slate-700">Dejará de aparecer en los grupos del curso para todos, y su hilo dejará de verse en el foro.</p>
      </Modal>
    </>
  )
}

function SignInToCreate() {
  const { pathname } = useLocation()
  const origin = { from: pathname }
  return (
    <Notice
      title="Inicia sesión para crear un grupo"
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
      Puedes ver los grupos y leer sus hilos sin cuenta; para crear uno necesitas iniciar sesión.
    </Notice>
  )
}

function GroupList({ groups, busy, failure, onRetire }) {
  return (
    <section aria-labelledby={LIST_HEADING_ID} className="mt-10">
      {/* tabIndex -1: recibe el foco cuando se retira el grupo que lo tenía. */}
      <h2 id={LIST_HEADING_ID} tabIndex={-1} className="text-lead font-semibold text-content">
        Grupos
      </h2>

      {groups.length === 0 ? (
        <p className="mt-3 text-body text-content-muted">Aún no hay grupos en este curso. Crea el primero.</p>
      ) : (
        <ul aria-label="Grupos del curso" className="mt-3.5 max-w-[72ch] border-t border-border">
          {groups.map((group) => (
            <li key={group.id} className="border-b border-border">
              <GroupRow group={group} busy={busy} failure={failure?.groupId === group.id ? failure.message : null} onRetire={onRetire} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function GroupRow({ group, busy, failure, onRetire }) {
  return (
    <article id={groupElementId(group.id)} tabIndex={-1} className="scroll-mt-6 px-1 py-4.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <h3 className="min-w-0 text-[1.03125rem] leading-snug font-semibold wrap-break-word">
          <Link to={`/foro/preguntas/${group.threadId}`} className="text-content transition-colors hover:text-accent">
            {group.name}
          </Link>
        </h3>
        <Tag>Grupo</Tag>
      </div>
      {group.description && (
        <p className="mt-1.5 line-clamp-2 text-body leading-relaxed wrap-break-word text-content-muted">{group.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-label text-content-muted tabular-nums">
        <span>{formatForumDate(group.createdAt)}</span>
        {group.member && <span className="font-medium text-accent">Eres miembro</span>}
        {group.canRetire && (
          <button
            type="button"
            id={retireButtonId(group.id)}
            disabled={busy}
            onClick={() => onRetire(group)}
            // Con el nombre del grupo: en la lista hay un «Retirar» por grupo.
            aria-label={`Retirar el grupo ${group.name}`}
            className="inline-flex min-h-6 items-center font-sans underline underline-offset-4 hover:text-content disabled:opacity-60"
          >
            Retirar
          </button>
        )}
      </div>
      {failure && (
        <p role="alert" className="mt-2 text-label text-error">
          {failure}
        </p>
      )}
    </article>
  )
}
