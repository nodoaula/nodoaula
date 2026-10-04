package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.NotFoundException;

/** YouTube no devuelve el video: no existe, es privado o fue eliminado (historia HU202). */
class VideoNotFoundException extends NotFoundException {

	VideoNotFoundException() {
		super("VIDEO_NOT_FOUND",
				"No encontramos ese video en YouTube: no existe, es privado o fue eliminado. Revisa el enlace.");
	}

}
