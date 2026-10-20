import { get, post } from '../../lib/apiClient.js'

/** Llamadas del módulo forum: todas pasan por el cliente único de la API. */

/** Preguntas de un curso, de la más reciente a la más antigua. Pública. */
export function listQuestions(courseId) {
  return get(`/forum/questions?${new URLSearchParams({ courseId })}`)
}

/** Publica una pregunta. Exige sesión iniciada. */
export function createQuestion({ courseId, resourceId, title, body }) {
  return post('/forum/questions', { courseId, resourceId, title, body })
}

/** Retira una pregunta: quien la publicó o una cuenta del equipo. */
export function retireQuestion(questionId) {
  return post(`/forum/questions/${encodeURIComponent(questionId)}/retire`)
}
