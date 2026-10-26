package io.github.nodoaula.catalog;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Datos de la corrección de un recurso (historia HU311), con las mismas reglas
 * que CreateResourceRequest: si cambian allí, cambian aquí y en el frontend.
 *
 * No trae enlace, tipo, archivo ni vía de ingreso, porque nada de eso se
 * corrige: para otro video o archivo se registra un recurso nuevo. Si llegan
 * en el cuerpo, se ignoran. La fecha no lleva @NotNull porque depende del
 * tipo: un video la exige y un apunte no la admite, y eso lo comprueba el
 * servicio, que es quien sabe de qué tipo es el recurso.
 */
public record UpdateResourceRequest(

		@NotBlank(message = "Escribe el título.")
		@Size(max = 300, message = "El título no puede tener más de 300 caracteres.")
		String title,

		@Size(max = 2000, message = "La descripción no puede tener más de 2000 caracteres.")
		String description,

		LocalDate publishedAt,

		@Positive(message = "La duración debe ser un número de segundos mayor que cero.")
		Integer durationSeconds,

		@Size(max = 200, message = "El canal no puede tener más de 200 caracteres.")
		String channel,

		@NotBlank(message = "Escribe el curso.")
		@Size(max = 200, message = "El curso no puede tener más de 200 caracteres.")
		String course,

		@NotEmpty(message = "Escribe al menos un tema.")
		List<@NotBlank(message = "Un tema no puede estar en blanco.")
		@Size(max = 200, message = "Un tema no puede tener más de 200 caracteres.") String> topics) {
}
