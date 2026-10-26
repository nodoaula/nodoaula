package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.ForbiddenException;

/**
 * Un recurso retirado solo lo vuelve a publicar la cuenta que lo retiró, y
 * mientras conserve el permiso sobre él (historia HU307). Así, lo que el
 * equipo retiró por moderación no lo devuelve quien lo aportó.
 */
class ResourceRepublishForbiddenException extends ForbiddenException {

	ResourceRepublishForbiddenException() {
		super("RESOURCE_REPUBLISH_FORBIDDEN", "Solo quien retiró este recurso puede volver a publicarlo.");
	}

}
