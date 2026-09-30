package io.github.nodoaula.catalog;

import java.time.LocalDate;
import java.util.List;

import org.hibernate.validator.constraints.URL;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Datos del formulario de registro manual de un recurso (historia HU105). El
 * frontend aplica las mismas reglas; si cambian aquí, cambian allí.
 *
 * Curso y cada tema son texto libre: si el nombre no existe en el vocabulario
 * controlado, el servicio lo crea en la misma operación (AB#93). El autor no
 * viaja en el cuerpo: lo toma el controlador de la cuenta con sesión iniciada.
 */
public record CreateResourceRequest(

		@NotBlank(message = "Escribe el título.")
		@Size(max = 300, message = "El título no puede tener más de 300 caracteres.")
		String title,

		@Size(max = 2000, message = "La descripción no puede tener más de 2000 caracteres.")
		String description,

		@NotNull(message = "Elige la fecha de publicación.")
		LocalDate publishedAt,

		@Positive(message = "La duración debe ser un número de segundos mayor que cero.")
		Integer durationSeconds,

		@Size(max = 200, message = "El canal no puede tener más de 200 caracteres.")
		String channel,

		@NotBlank(message = "Escribe el enlace.")
		@URL(message = "Escribe un enlace válido, como https://ejemplo.com.")
		@Size(max = 2048, message = "El enlace no puede tener más de 2048 caracteres.")
		String url,

		@NotNull(message = "Elige el tipo de recurso.")
		ResourceType resourceType,

		@NotBlank(message = "Escribe el curso.")
		@Size(max = 200, message = "El curso no puede tener más de 200 caracteres.")
		String course,

		@NotEmpty(message = "Escribe al menos un tema.")
		List<@NotBlank(message = "Un tema no puede estar en blanco.")
		@Size(max = 200, message = "Un tema no puede tener más de 200 caracteres.") String> topics) {

}
