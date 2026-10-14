package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.ForbiddenException;

/**
 * Un recurso solo lo modifica quien lo aportó o una cuenta del equipo
 * (ADR-007). Lo lanza la corrección de sus datos (historia HU311).
 */
class ResourceChangeForbiddenException extends ForbiddenException {

	ResourceChangeForbiddenException() {
		super("RESOURCE_CHANGE_FORBIDDEN",
				"Solo quien aportó este recurso o una cuenta del equipo puede modificarlo.");
	}

}
