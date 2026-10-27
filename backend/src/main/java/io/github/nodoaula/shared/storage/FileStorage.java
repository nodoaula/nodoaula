package io.github.nodoaula.shared.storage;

import java.net.URI;
import java.nio.file.Path;
import java.time.Duration;

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
	 * Borrar un archivo que no existe no es un error.
	 *
	 * @throws StorageUnavailableException si no se pudo borrar
	 */
	void delete(String key);

	/**
	 * Descarga el archivo en {@code target}, que se sobrescribe, leyéndolo por
	 * partes y sin cargarlo en memoria.
	 *
	 * @throws StorageUnavailableException si no se pudo descargar
	 */
	void download(String key, Path target);

	/**
	 * Enlace con el que cualquiera puede descargar el archivo, sin credenciales,
	 * hasta que caduca. Una descarga que empezó antes de caducar termina.
	 *
	 * @throws StorageUnavailableException si no se pudo firmar
	 */
	URI signedUrl(String key, Duration validity);

}
