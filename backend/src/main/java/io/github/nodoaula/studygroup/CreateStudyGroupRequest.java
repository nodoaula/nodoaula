package io.github.nodoaula.studygroup;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Datos del formulario de crear un grupo de estudio (historia HU404). Quien
 * lo crea no viaja en el cuerpo: lo toma el controlador de la cuenta con
 * sesión.
 */
public record CreateStudyGroupRequest(

		@NotNull(message = "Elige el curso del grupo.")
		Long courseId,

		@NotBlank(message = "Escribe el nombre del grupo.")
		@Size(max = 200, message = "El nombre no puede tener más de 200 caracteres.")
		String name,

		// Opcional.
		@Size(max = 2000, message = "La descripción no puede tener más de 2000 caracteres.")
		String description) {
}
