package io.github.nodoaula.forum;

import io.github.nodoaula.shared.error.NotFoundException;

/** La respuesta no existe o fue retirada: para quien la pide es lo mismo. */
class AnswerNotFoundException extends NotFoundException {

	AnswerNotFoundException() {
		super("ANSWER_NOT_FOUND", "La respuesta que buscas no existe o ya no está disponible.");
	}

}
