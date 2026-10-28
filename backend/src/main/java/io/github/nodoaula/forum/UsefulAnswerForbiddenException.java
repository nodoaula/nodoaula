package io.github.nodoaula.forum;

import io.github.nodoaula.shared.error.ForbiddenException;

/** La respuesta útil la marca o la quita solo quien hizo la pregunta. */
class UsefulAnswerForbiddenException extends ForbiddenException {

	UsefulAnswerForbiddenException() {
		super("USEFUL_ANSWER_FORBIDDEN", "Solo quien hizo la pregunta puede marcar o quitar la respuesta útil.");
	}

}
