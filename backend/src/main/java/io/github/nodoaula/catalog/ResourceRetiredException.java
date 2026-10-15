package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.ConflictException;

/**
 * El recurso está retirado del catálogo (historia HU307): no se retira otra
 * vez ni se corrige. Para corregirlo, primero se vuelve a publicar.
 */
class ResourceRetiredException extends ConflictException {

	ResourceRetiredException() {
		super("RESOURCE_RETIRED", "Este recurso está retirado del catálogo.");
	}

}
