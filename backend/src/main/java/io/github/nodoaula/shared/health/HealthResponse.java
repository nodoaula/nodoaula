package io.github.nodoaula.shared.health;

/** Cuerpo de /api/health: el estado vale siempre "UP", porque un proceso caído no responde. */
public record HealthResponse(String status) {
}
