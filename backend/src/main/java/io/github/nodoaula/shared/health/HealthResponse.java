package io.github.nodoaula.shared.health;

/**
 * Respuesta de la comprobación de disponibilidad del backend.
 *
 * <p>Es un DTO y no una entidad, conforme al ADR-008 §4: por la API nunca sale
 * una entidad. Los DTO son las únicas clases públicas de un módulo junto al
 * servicio.
 */
public record HealthResponse(String status) {
}
