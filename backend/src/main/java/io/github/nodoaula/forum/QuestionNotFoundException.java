package io.github.nodoaula.forum;

import io.github.nodoaula.shared.error.NotFoundException;

/** La pregunta no existe o fue retirada: para quien la pide es lo mismo. */
class QuestionNotFoundException extends NotFoundException {

	QuestionNotFoundException() {
		super("QUESTION_NOT_FOUND", "La pregunta que buscas no existe o ya no está disponible.");
	}

}
