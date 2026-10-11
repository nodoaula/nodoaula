package io.github.nodoaula.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** Archivo de un apunte. La clave es el nombre con que se guarda, y la genera el servidor. */
@Embeddable
record DocumentFile(
		@Column(name = "file_key") String key,
		@Column(name = "file_size_bytes") long sizeBytes,
		@Column(name = "page_count") int pageCount) {
}
