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

	/** Se guarda junto al archivo: «x.pdf» tiene su vista previa en «x-vista-previa.pdf». */
	static String keyFor(String fileKey) {
		return fileKey.substring(0, fileKey.length() - ".pdf".length()) + "-vista-previa.pdf";
	}

}
