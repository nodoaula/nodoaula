package io.github.nodoaula.account;

import io.github.nodoaula.shared.error.ConflictException;

/**
 * El registro sí dice que el correo ya tiene cuenta, aunque eso permita
 * averiguarlo: sin el aviso, el usuario no sabría por qué falla (ADR-007).
 */
class EmailAlreadyInUseException extends ConflictException {

	EmailAlreadyInUseException() {
		super("EMAIL_ALREADY_IN_USE", "Ya existe una cuenta con este correo.");
	}

}
