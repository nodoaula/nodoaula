package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.ConflictException;

/** Solo se vuelve a publicar un recurso retirado (historia HU307). */
class ResourceNotRetiredException extends ConflictException {

	ResourceNotRetiredException() {
		super("RESOURCE_NOT_RETIRED", "Este recurso ya está publicado en el catálogo.");
	}

}
