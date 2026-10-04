package io.github.nodoaula.catalog;

import java.time.LocalDate;

/**
 * Lo que YouTube devuelve de un video, ya convertido a los tipos del
 * formulario de registro (historia HU202). Un campo que YouTube no trae, o
 * trae en blanco, llega como null: nunca con un valor por defecto ni
 * rellenado con otro campo.
 */
record VideoMetadata(
		String title,
		String description,
		LocalDate publishedAt,
		Integer durationSeconds,
		String channel) {
}
