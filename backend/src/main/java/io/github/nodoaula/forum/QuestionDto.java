package io.github.nodoaula.forum;

import java.time.Instant;

/**
 * Vista pública de una pregunta. No lleva el correo ni el identificador de
 * quien la publicó: el nombre se mostrará cuando exista el perfil de la
 * cuenta. canRetire y canMarkUseful dicen si quien la ve puede retirarla o
 * marcar la respuesta útil, para que la pantalla no ofrezca lo que la API
 * rechazaría.
 */
public record QuestionDto(
		Long id,
		Long courseId,
		Long resourceId,
		String title,
		String body,
		Instant createdAt,
		Long usefulAnswerId,
		boolean canRetire,
		boolean canMarkUseful) {
}
