package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.NotFoundException;

/** La ficha pedida no corresponde a ningún recurso del catálogo (historia HU108). */
class ResourceNotFoundException extends NotFoundException {

	ResourceNotFoundException() {
		super("RESOURCE_NOT_FOUND", "El recurso que buscas no existe o ya no está en el catálogo.");
	}

}
