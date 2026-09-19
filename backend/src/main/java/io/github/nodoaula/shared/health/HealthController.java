package io.github.nodoaula.shared.health;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Comprobación de que el backend atiende peticiones, sin consultar la base de
 * datos.
 *
 * <p>Existe además de los endpoints de Actuator porque la reescritura del sitio
 * estático solo reenvía {@code /api/*} (ADR-006 §4): el frontend no alcanza
 * {@code /actuator/**} desde su propio dominio. El plan gratuito de Render
 * suspende el servicio tras quince minutos sin tráfico (ADR-004), de modo que
 * el frontend llama aquí al cargar para saber si debe avisar de que el servidor
 * está arrancando.
 *
 * <p>No consulta la base a propósito: informa de si el proceso responde, no de
 * si Supabase está disponible. Para eso está el grupo {@code database} de
 * Actuator, que usa la tarea programada de mantenimiento de actividad.
 *
 * <p>Cuando se incorpore Spring Security (ADR-007), esta ruta debe quedar
 * accesible sin sesión iniciada: el aviso de arranque se muestra antes de que
 * exista ninguna.
 */
@RestController
@RequestMapping("/api/health")
class HealthController {

	@GetMapping
	HealthResponse health() {
		return new HealthResponse("UP");
	}

}
