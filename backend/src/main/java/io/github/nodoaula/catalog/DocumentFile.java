package io.github.nodoaula.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * Archivo de un apunte. La clave es el nombre con que se guarda, y la genera el
 * servidor. La huella es el SHA-256 del contenido, en hexadecimal: con ella se
 * reconoce el mismo archivo aunque lo suban con otro nombre (historia HU413).
 * Los apuntes anteriores a HU413 no la tienen.
 */
@Embeddable
record DocumentFile(
		@Column(name = "file_key") String key,
		@Column(name = "file_size_bytes") long sizeBytes,
		@Column(name = "page_count") int pageCount,
		@Column(name = "file_sha256") String sha256) {

	DocumentFile(String key, long sizeBytes, int pageCount) {
		this(key, sizeBytes, pageCount, null);
	}

}
