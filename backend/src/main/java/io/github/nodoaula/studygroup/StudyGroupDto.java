package io.github.nodoaula.studygroup;

import java.time.Instant;

/**
 * Vista pública de un grupo de estudio. Como las preguntas del foro, no lleva
 * el correo ni el identificador de quien lo creó. description es null si el
 * grupo no tiene. threadId es la pregunta del foro en la que conversa el
 * grupo. memberCount lo ve cualquiera, también sin sesión (HU405); quiénes
 * son, solo los miembros. member dice si quien lo ve es miembro, y canRetire
 * si puede retirarlo, para que la pantalla no ofrezca lo que la API
 * rechazaría.
 */
public record StudyGroupDto(
		Long id,
		Long courseId,
		String name,
		String description,
		Instant createdAt,
		Long threadId,
		long memberCount,
		boolean member,
		boolean canRetire) {
}
