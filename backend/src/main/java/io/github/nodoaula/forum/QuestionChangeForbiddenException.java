package io.github.nodoaula.forum;

import io.github.nodoaula.shared.error.ForbiddenException;

/** Una pregunta solo la retira quien la publicó o una cuenta del equipo (ADR-007). */
class QuestionChangeForbiddenException extends ForbiddenException {

	QuestionChangeForbiddenException() {
		super("QUESTION_CHANGE_FORBIDDEN",
				"Solo quien publicó esta pregunta o una cuenta del equipo puede retirarla.");
	}

}
