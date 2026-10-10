package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.UnavailableException;

/**
 * Guardar el apunte dejaría el almacenamiento por encima de su tope
 * (historia HU302). Solo se dejan de aceptar apuntes; lo demás sigue igual.
 */
class DocumentStorageFullException extends UnavailableException {

	DocumentStorageFullException() {
		super("DOCUMENT_STORAGE_FULL",
				"Por ahora no hay espacio para más apuntes. Inténtalo de nuevo más adelante.",
				null);
	}

}
