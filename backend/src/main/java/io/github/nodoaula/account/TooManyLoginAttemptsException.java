package io.github.nodoaula.account;

import io.github.nodoaula.shared.error.TooManyRequestsException;

/**
 * El mismo rechazo exista o no una cuenta con el correo, para que no revele
 * cuáles la tienen (ADR-007).
 */
class TooManyLoginAttemptsException extends TooManyRequestsException {

	TooManyLoginAttemptsException(long retryAfterSeconds) {
		super("TOO_MANY_LOGIN_ATTEMPTS",
				"Demasiados intentos fallidos con este correo. Espera antes de volver a intentarlo.",
				retryAfterSeconds);
	}

}
