package io.github.nodoaula.catalog;

import java.util.List;

import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Formulario de subir un apunte (historia HU302), que llega como
 * multipart/form-data. Título, descripción, curso y temas siguen las mismas
 * reglas que en el registro por enlace. El autor no viaja en el cuerpo: lo
 * toma el controlador de la cuenta con sesión iniciada.
 */
public record DocumentUploadRequest(

		@NotNull(message = "Elige el archivo PDF.")
		MultipartFile file,

		@NotBlank(message = "Escribe el título.")
		@Size(max = 300, message = "El título no puede tener más de 300 caracteres.")
		String title,

		@Size(max = 2000, message = "La descripción no puede tener más de 2000 caracteres.")
		String description,

		@NotBlank(message = "Escribe el curso.")
		@Size(max = 200, message = "El curso no puede tener más de 200 caracteres.")
		String course,

		@NotEmpty(message = "Escribe al menos un tema.")
		List<@NotBlank(message = "Un tema no puede estar en blanco.")
		@Size(max = 200, message = "Un tema no puede tener más de 200 caracteres.") String> topics,

		// Boolean y no boolean: si la casilla no llega, @NotNull da el mismo
		// mensaje en vez de un error de conversión.
		@NotNull(message = RIGHTS_MESSAGE)
		@AssertTrue(message = RIGHTS_MESSAGE)
		Boolean rightsDeclared) {

	static final String RIGHTS_MESSAGE =
			"Declara que el apunte es de tu autoría o que tienes permiso para compartirlo.";

}
