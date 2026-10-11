package io.github.nodoaula.catalog;

import java.util.List;

/**
 * Vista pública de un recurso para el catálogo: nunca la entidad, según
 * ADR-008. El id es el que enlaza cada elemento del listado con su ficha. Un
 * video trae su duración y un apunte su número de páginas; lo que no aplica
 * llega como null.
 */
public record ResourceDto(Long id, String title, String course, ResourceType resourceType,
		Integer durationSeconds, Integer pageCount, String url, List<String> topics) {
}
