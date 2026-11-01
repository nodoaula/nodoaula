import { useEffect, useState } from 'react'

import { formatForumDate } from '../forum/format.js'
import { listMembers } from './api.js'

function describeFailure(error) {
  if (error.code === 'STUDY_GROUP_MEMBERS_ONLY') return 'Solo los miembros del grupo ven quiénes pertenecen a él.'
  if (error.status === 401) return 'Tu sesión terminó. Inicia sesión de nuevo.'
  return 'No se pudieron cargar los miembros. Intenta de nuevo.'
}

/**
 * Los miembros de un grupo (HU405), que solo ve quien pertenece a él. Nunca
 * muestra el correo: la API no lo envía. Tampoco el nombre, que llegará con
 * el perfil de la cuenta (HU506); mientras tanto, cada miembro se distingue
 * por si es quien mira, si creó el grupo y cuándo se unió.
 *
 * Se carga al desplegarse, de modo que muestra a quienes hay en ese momento.
 */
export default function GroupMembers({ groupId, id }) {
  const [members, setMembers] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    listMembers(groupId)
      .then((loaded) => {
        if (active) setMembers(loaded)
      })
      .catch((err) => {
        if (!active) return
        console.error('No se pudieron cargar los miembros del grupo', err)
        setError(err)
      })
    return () => {
      active = false
    }
  }, [groupId])

  let content
  if (error) {
    content = (
      <p role="alert" className="text-label text-error">
        {describeFailure(error)}
      </p>
    )
  } else if (members === null) {
    content = <output className="block text-label text-content-muted">Cargando miembros…</output>
  } else {
    content = (
      <>
        <ul aria-label="Miembros del grupo" className="grid gap-2">
          {members.map((member, index) => (
            // Sin identificador de la cuenta: la API no lo envía, a propósito.
            <li key={`${member.joinedAt}-${index}`} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className="text-sm font-medium text-content">{member.you ? 'Tú' : 'Miembro'}</span>
              {member.creator && <span className="text-label text-accent">Creó el grupo</span>}
              <span className="font-mono text-label text-content-muted tabular-nums">
                Se unió el {formatForumDate(member.joinedAt)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-caption text-content-faint">
          Los nombres aparecerán cuando las cuentas tengan perfil. El correo no se muestra nunca.
        </p>
      </>
    )
  }

  return (
    <div id={id} className="mt-3 max-w-[48ch] rounded-2xl border border-border bg-surface-raised p-4">
      {content}
    </div>
  )
}
