package io.github.nodoaula.studygroup;

import java.time.Instant;

/**
 * Un miembro de un grupo, tal como lo ven los demás miembros (HU405). Nunca
 * lleva el correo ni el identificador de la cuenta: el nombre se añadirá
 * cuando exista el perfil de la cuenta (HU506), como en el foro. you dice si
 * es quien mira, y creator si es quien creó el grupo.
 */
public record StudyGroupMemberDto(
		Instant joinedAt,
		boolean you,
		boolean creator) {
}
