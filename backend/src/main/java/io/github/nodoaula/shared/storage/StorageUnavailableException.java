package io.github.nodoaula.shared.storage;

import io.github.nodoaula.shared.error.UnavailableException;

/** No se pudo guardar o borrar un archivo: almacenamiento sin configurar, caído o que rechazó la operación. */
public class StorageUnavailableException extends UnavailableException {

	public StorageUnavailableException(Throwable cause) {
		super("STORAGE_UNAVAILABLE",
				"No fue posible guardar el archivo en este momento. Inténtalo de nuevo más tarde.",
				cause);
	}

}
