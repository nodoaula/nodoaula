package io.github.nodoaula.shared.health;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Existe además de Actuator porque la reescritura del sitio estático solo
 * reenvía {@code /api/*}, de modo que el frontend no alcanza
 * {@code /actuator/**} desde su propio dominio. No consulta la base de datos a
 * propósito, y debe seguir accesible sin sesión iniciada.
 */
@RestController
@RequestMapping("/api/health")
class HealthController {

	@GetMapping
	HealthResponse health() {
		return new HealthResponse("UP");
	}

}
