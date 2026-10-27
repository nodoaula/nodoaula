package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.NotFoundException;

/**
 * Se pidió la vista previa de un recurso que no tiene: un video o un apunte de
 * 3 páginas o menos (historia HU412).
 */
class DocumentPreviewNotFoundException extends NotFoundException {

	DocumentPreviewNotFoundException() {
		super("DOCUMENT_PREVIEW_NOT_FOUND", "Este recurso no tiene vista previa.");
	}

}
