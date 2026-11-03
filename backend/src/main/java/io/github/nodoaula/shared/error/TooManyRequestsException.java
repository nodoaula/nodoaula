package io.github.nodoaula.shared.error;

/**
 * Hay que esperar antes de repetir la operación. Se responde 429 con el mensaje
 * como detalle, de modo que debe estar escrito para el usuario, y con los
 * segundos de espera en la cabecera Retry-After. El código permite al frontend
 * distinguir la causa sin interpretar el texto.
 */
public abstract class TooManyRequestsException extends RuntimeException {

	private final String code;
	private final long retryAfterSeconds;

	protected TooManyRequestsException(String code, String message, long retryAfterSeconds) {
		super(message);
		this.code = code;
		this.retryAfterSeconds = retryAfterSeconds;
	}

	public String getCode() {
		return code;
	}

	public long getRetryAfterSeconds() {
		return retryAfterSeconds;
	}

}
