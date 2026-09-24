package io.github.nodoaula.catalog;

import java.time.LocalDate;
import java.util.List;

/**
 * Vista pública de la ficha de un recurso (historia HU108): los diez campos
 * vigentes del esquema de metadatos. Los opcionales (descripción, fecha de
 * publicación, duración y canal) llegan como null cuando no se registraron.
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
		String course,
		List<String> topics) {
}
