package io.github.nodoaula.forum;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Datos del formulario de publicar una pregunta (historia HU401). El autor no
 * viaja en el cuerpo: lo toma el controlador de la cuenta con sesión.
 */
public record CreateQuestionRequest(

		@NotNull(message = "Elige el curso de la pregunta.")
		Long courseId,

		// Opcional: un recurso concreto del curso sobre el que se pregunta.
		Long resourceId,

		@NotBlank(message = "Escribe el título de la pregunta.")
		@Size(max = 200, message = "El título no puede tener más de 200 caracteres.")
		String title,

		@NotBlank(message = "Escribe tu pregunta.")
		@Size(max = 5000, message = "La pregunta no puede tener más de 5000 caracteres.")
		String body) {
}
