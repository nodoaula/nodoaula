package io.github.nodoaula.catalog;

/** Vista pública de un recurso para el catálogo: nunca la entidad, según ADR-008. */
public record ResourceDto(String title, String course, ResourceType resourceType, Integer durationSeconds) {
}
