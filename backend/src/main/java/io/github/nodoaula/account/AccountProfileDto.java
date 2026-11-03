package io.github.nodoaula.account;

import java.time.Instant;

/**
 * Todos los datos de una cuenta, para la página de su perfil (HU506). Solo la
 * recibe su dueño: no hay ruta para pedir el perfil de otra cuenta. Un dato que
 * la cuenta no tiene llega como null, y la pantalla lo muestra como «No
 * disponible»: el perfil de una cuenta anterior a HU506 o la fecha de
 * autorización de una anterior a HU510.
 */
public record AccountProfileDto(
		String name,
		String email,
		InstitutionDto institution,
		UserType userType,
		Instant createdAt,
		Instant dataProcessingAuthorizedAt,
		boolean teamMember) {
}
