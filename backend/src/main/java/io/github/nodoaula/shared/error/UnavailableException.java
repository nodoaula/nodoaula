package io.github.nodoaula.shared.error;

/**
 * Un servicio externo del que depende la operación no respondió o la
 * rechazó. Se responde 503 con el mensaje como detalle, de modo que debe
 * estar escrito para el usuario. El código permite al frontend distinguir la
 * causa sin interpretar el texto.
 */
public abstract class UnavailableException extends RuntimeException {

	private final String code;

	protected UnavailableException(String code, String message, Throwable cause) {
		super(message, cause);
		this.code = code;
	}

	public String getCode() {
		return code;
	}

}
