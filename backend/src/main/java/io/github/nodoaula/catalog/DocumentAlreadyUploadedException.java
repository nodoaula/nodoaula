package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.ConflictException;

/** El mismo archivo ya está en el catálogo (historia HU413): no se sube otra vez. */
class DocumentAlreadyUploadedException extends ConflictException {

	DocumentAlreadyUploadedException() {
		super("DOCUMENT_ALREADY_UPLOADED", "Este apunte ya está en el catálogo.");
	}

}
