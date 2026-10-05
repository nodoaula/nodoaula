package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.BadRequestException;

/** Lo pegado en «Enlace» no contiene un identificador de YouTube reconocible (historia HU202). */
class InvalidVideoLinkException extends BadRequestException {

	InvalidVideoLinkException() {
		super("INVALID_VIDEO_LINK",
				"El enlace no corresponde a un video de YouTube. Revisa que esté completo, "
						+ "como https://www.youtube.com/watch?v=… o https://youtu.be/….");
	}

}
