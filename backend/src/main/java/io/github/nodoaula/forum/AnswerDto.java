package io.github.nodoaula.forum;

import java.time.Instant;

/**
 * Vista pública de una respuesta. Como en las preguntas, no lleva el correo
 * ni el identificador de quien la publicó. mine dice si es de quien la ve, y
 * canRetire si puede retirarla, para que la pantalla no ofrezca lo que la API
 * rechazaría.
 */
public record AnswerDto(
		Long id,
		String body,
		Instant createdAt,
		boolean mine,
		boolean canRetire) {
}
