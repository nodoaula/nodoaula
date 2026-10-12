package io.github.nodoaula.catalog;

import io.github.nodoaula.shared.error.ConflictException;

/**
 * El video ya está en el catálogo (historia HU308). Se compara el
 * identificador de YouTube, no el texto del enlace: youtu.be, watch?v= y un
 * enlace con minuto son el mismo video.
 */
class VideoAlreadyRegisteredException extends ConflictException {

	VideoAlreadyRegisteredException() {
		super("VIDEO_ALREADY_REGISTERED", "Este video ya está registrado en el catálogo.");
	}

}
