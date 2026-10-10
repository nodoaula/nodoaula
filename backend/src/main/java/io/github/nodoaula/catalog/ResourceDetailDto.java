package io.github.nodoaula.catalog;

import java.time.LocalDate;
import java.util.List;

/**
 * Vista pública de la ficha de un recurso (historia HU108): los nueve campos
 * vigentes del esquema de metadatos, más su identificador y el de su curso,
 * con el que la ficha enlaza al catálogo filtrado por ese curso. Los opcionales
 * (descripción, fecha de publicación, duración y canal) llegan como null
 * cuando no se registraron.
 * Nunca la entidad, según ADR-008.
 */
public record ResourceDetailDto(
		Long id,
		String title,
		String description,
		LocalDate publishedAt,
		Integer durationSeconds,
		String channel,
		String url,
		ResourceType resourceType,
		Long courseId,
		String course,
		List<String> topics) {
}
