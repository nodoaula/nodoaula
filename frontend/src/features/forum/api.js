import { get, post, put, remove } from '../../lib/apiClient.js'

/** Llamadas del módulo forum: todas pasan por el cliente único de la API. */

/** Preguntas de un curso, de la más reciente a la más antigua. Pública. */
export function listQuestions(courseId) {
  return get(`/forum/questions?${new URLSearchParams({ courseId })}`)
}

/** Una pregunta. De una retirada solo llegan su curso y `retired`. Pública. */
export function getQuestion(questionId) {
  return get(`/forum/questions/${encodeURIComponent(questionId)}`)
}

/** Publica una pregunta. Exige sesión iniciada. */
export function createQuestion({ courseId, resourceId, title, body }) {
  return post('/forum/questions', { courseId, resourceId, title, body })
}

/** Retira una pregunta: quien la publicó o una cuenta del equipo. */
export function retireQuestion(questionId) {
  return post(`/forum/questions/${encodeURIComponent(questionId)}/retire`)
}

/** Las respuestas de una pregunta, de la más antigua a la más reciente. Pública. */
export function listAnswers(questionId) {
  return get(`/forum/questions/${encodeURIComponent(questionId)}/answers`)
}

/** Responde una pregunta. Exige sesión iniciada. */
export function createAnswer(questionId, body) {
  return post(`/forum/questions/${encodeURIComponent(questionId)}/answers`, { body })
}

/** Retira una respuesta: quien la publicó o una cuenta del equipo. */
export function retireAnswer(answerId) {
  return post(`/forum/answers/${encodeURIComponent(answerId)}/retire`)
}

/** Marca la respuesta útil, en lugar de la que hubiera. Solo quien preguntó. */
export function markUsefulAnswer(questionId, answerId) {
  return put(`/forum/questions/${encodeURIComponent(questionId)}/useful-answer`, { answerId })
}

/** Quita la marca de respuesta útil. Solo quien preguntó. */
export function clearUsefulAnswer(questionId) {
  return remove(`/forum/questions/${encodeURIComponent(questionId)}/useful-answer`)
}
