package io.github.nodoaula.forum;

import io.github.nodoaula.shared.error.ForbiddenException;

/** Una respuesta solo la retira quien la publicó o una cuenta del equipo. */
class AnswerChangeForbiddenException extends ForbiddenException {

	AnswerChangeForbiddenException() {
		super("ANSWER_CHANGE_FORBIDDEN",
				"Solo quien publicó esta respuesta o una cuenta del equipo puede retirarla.");
	}

}
