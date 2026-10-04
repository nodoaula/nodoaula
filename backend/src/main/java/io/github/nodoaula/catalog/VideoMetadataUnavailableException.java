package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.UnavailableException;

/**
 * No se pudo consultar YouTube: cuota agotada, clave ausente o inválida,
 * error del servicio o tiempo agotado (historia HU202). No es culpa del
 * usuario, y el formulario sigue sirviendo para completar los campos a mano.
 */
class VideoMetadataUnavailableException extends UnavailableException {

	VideoMetadataUnavailableException(Throwable cause) {
		super("VIDEO_METADATA_UNAVAILABLE",
				"No fue posible consultar YouTube en este momento. Completa los campos a mano "
						+ "o inténtalo de nuevo más tarde.",
				cause);
	}

}
