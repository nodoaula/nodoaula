import { get, post } from '../../lib/apiClient.js'

/** Llamadas del módulo studygroup: todas pasan por el cliente único de la API. */

/** Grupos de un curso, del más reciente al más antiguo. Pública. */
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
