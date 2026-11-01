package io.github.nodoaula.studygroup;

import java.time.Instant;

/**
 * Vista pública de un grupo de estudio. Como las preguntas del foro, no lleva
 * el correo ni el identificador de quien lo creó. description es null si el
 * grupo no tiene. threadId es la pregunta del foro en la que conversa el
 * grupo. member dice si quien lo ve es miembro, y canRetire si puede
 * retirarlo, para que la pantalla no ofrezca lo que la API rechazaría.
 */
public record StudyGroupDto(
		Long id,
		Long courseId,
		String name,
		String description,
		Instant createdAt,
		Long threadId,
		boolean member,
		boolean canRetire) {
}
