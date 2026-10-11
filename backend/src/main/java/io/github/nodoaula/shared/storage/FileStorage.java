package io.github.nodoaula.shared.storage;

import java.nio.file.Path;

/**
 * Almacenamiento de archivos. Los módulos dependen de esta interfaz, y solo su
 * implementación conoce al proveedor.
 */
public interface FileStorage {

	/**
	 * Guarda el archivo con esa clave. Nunca reemplaza uno existente.
	 *
	 * @throws StorageUnavailableException si no se pudo guardar
	 */
	void store(String key, Path file, String contentType);

	/**
	 * @throws StorageUnavailableException si no se pudo borrar
	 */
	void delete(String key);

}
