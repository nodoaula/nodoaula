package io.github.nodoaula.catalog;

import java.util.List;

/**
 * Vista pública de un recurso para el catálogo: nunca la entidad, según
 * ADR-008. El id es el que enlaza cada elemento del listado con su ficha.
 */
public record ResourceDto(Long id, String title, String course, ResourceType resourceType,
		Integer durationSeconds, String url, List<String> topics) {
}
