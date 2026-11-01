package io.github.nodoaula.forum;

import java.time.Instant;

/**
 * Vista pública de una pregunta. No lleva el correo ni el identificador de
 * quien la publicó: el nombre se mostrará cuando exista el perfil de la
 * cuenta. answerCount cuenta solo las respuestas visibles. canRetire y
 * canMarkUseful dicen si quien la ve puede retirarla o marcar la respuesta
 * útil, para que la pantalla no ofrezca lo que la API rechazaría. group marca
 * el hilo de un grupo de estudio (HU404), y canAnswer dice si quien la ve
 * puede responder: hace falta sesión y, en el hilo de un grupo, ser miembro.
 * De una retirada solo llegan el identificador, el curso y la marca retired.
 */
public record QuestionDto(
		Long id,
		Long courseId,
		Long resourceId,
		String title,
		String body,
		Instant createdAt,
		Long usefulAnswerId,
		long answerCount,
		boolean retired,
		boolean canRetire,
		boolean canMarkUseful,
		boolean group,
		boolean canAnswer) {
}
