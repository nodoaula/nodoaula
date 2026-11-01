import { ApiError, get, post, remove } from '../../lib/apiClient.js'

/** Llamadas del módulo studygroup: todas pasan por el cliente único de la API. */

/** Grupos de un curso, del más reciente al más antiguo, con su número de miembros. Pública. */
export function listGroups(courseId) {
  return get(`/study-groups?${new URLSearchParams({ courseId })}`)
}

/** Crea un grupo, con su hilo en el foro del curso. Exige sesión iniciada. */
export function createGroup({ courseId, name, description }) {
  return post('/study-groups', { courseId, name, description })
}

/** Retira un grupo, con su hilo: quien lo creó o una cuenta del equipo. */
export function retireGroup(groupId) {
  return post(`/study-groups/${encodeURIComponent(groupId)}/retire`)
}

/** Une la cuenta con sesión al grupo. Devuelve el grupo actualizado. */
export function joinGroup(groupId) {
  return post(`/study-groups/${encodeURIComponent(groupId)}/members`)
}

/** Saca la cuenta con sesión del grupo. Devuelve el grupo actualizado. */
export function leaveGroup(groupId) {
  return remove(`/study-groups/${encodeURIComponent(groupId)}/members/me`)
}

/** Los miembros del grupo, sin correo. Solo para quien pertenece a él. */
export function listMembers(groupId) {
  return get(`/study-groups/${encodeURIComponent(groupId)}/members`)
}

/**
 * Une la cuenta con sesión al grupo de un hilo del foro, desde la página del
 * hilo, que conoce el hilo y su curso pero no el grupo. Si ya era miembro,
 * lo da por hecho igual. Si el grupo ya no está entre los del curso, falla
 * como fallaría la API con un grupo retirado.
 */
export async function joinGroupOfThread(courseId, threadId) {
  const group = (await listGroups(courseId)).find((candidate) => candidate.threadId === threadId)
  if (!group) {
    throw new ApiError('El grupo del hilo ya no está entre los del curso', {
      status: 404,
      body: { code: 'STUDY_GROUP_NOT_FOUND' },
    })
  }
  try {
    await joinGroup(group.id)
  } catch (error) {
    if (error.code !== 'ALREADY_A_MEMBER') throw error
  }
}
