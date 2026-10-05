package io.github.nodoaula.catalog;

import java.time.LocalDate;
import java.util.List;

/**
 * Datos de un video de YouTube para autocompletar el formulario de registro
 * (historia HU202). Los campos que YouTube no trajo llegan como null y se
 * listan en missingFields con los nombres del formulario, para que el
 * frontend no los muestre en el modal y los señale al insertarlos.
 *
 * url es la forma canónica del enlace, que el frontend pone en el campo
 * «Enlace» al insertar: así un identificador suelto pasa la validación de URL.
 */
public record VideoMetadataDto(
		String videoId,
		String url,
		String title,
		String description,
		LocalDate publishedAt,
		Integer durationSeconds,
		String channel,
		List<String> missingFields) {
}
