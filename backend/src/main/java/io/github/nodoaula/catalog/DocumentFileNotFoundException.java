package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.NotFoundException;

/** Se pidió el archivo de un recurso que no tiene: un video (historia HU411). */
class DocumentFileNotFoundException extends NotFoundException {

	DocumentFileNotFoundException() {
		super("DOCUMENT_FILE_NOT_FOUND", "Este recurso no tiene un archivo para leer o descargar.");
	}

}
