package io.github.nodoaula.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * Vista previa de un apunte (historia HU412): un PDF aparte con sus primeras
 * páginas, para quien no tiene sesión. Como el archivo, la clave la genera el
 * servidor.
 */
@Embeddable
record DocumentPreview(
		@Column(name = "preview_key") String key,
		@Column(name = "preview_size_bytes") long sizeBytes,
		@Column(name = "preview_page_count") int pageCount) {
}
