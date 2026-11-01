package io.github.nodoaula.account;

import io.github.nodoaula.shared.error.ConflictException;

/** El paso de completar el perfil es para las cuentas que aún no lo tienen. */
class ProfileAlreadyCompleteException extends ConflictException {

	ProfileAlreadyCompleteException() {
		super("PROFILE_ALREADY_COMPLETE", "Tu perfil ya está completo.");
	}

}
