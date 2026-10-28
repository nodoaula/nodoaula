package io.github.nodoaula.forum;

import jakarta.validation.constraints.NotNull;

/** La respuesta que quien hizo la pregunta marca como útil (historia HU402). */
public record UsefulAnswerRequest(

		@NotNull(message = "Elige la respuesta útil.")
		Long answerId) {
}
