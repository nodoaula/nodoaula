package io.github.nodoaula.catalog;

/**
 * Fuente externa de los metadatos de un video (historia HU202). Es una
 * dependencia externa reemplazable, de modo que el módulo depende de esta
 * interfaz y solo su implementación conoce al proveedor (ADR-008, apartado 4).
 */
interface VideoMetadataProvider {

	/**
	 * @param videoId identificador ya validado del video
	 * @throws VideoNotFoundException si el video no existe, es privado o fue eliminado
	 * @throws VideoMetadataUnavailableException si la consulta no pudo hacerse
	 */
	VideoMetadata fetch(String videoId);

}
