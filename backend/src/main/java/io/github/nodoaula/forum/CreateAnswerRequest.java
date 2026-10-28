package io.github.nodoaula.forum;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Datos del formulario de responder una pregunta (historia HU402). La
 * pregunta va en la ruta y el autor lo toma el controlador de la sesión.
 */
public record CreateAnswerRequest(

		@NotBlank(message = "Escribe tu respuesta.")
		@Size(max = 5000, message = "La respuesta no puede tener más de 5000 caracteres.")
		String body) {
}
