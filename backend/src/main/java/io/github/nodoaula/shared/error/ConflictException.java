package io.github.nodoaula.shared.error;

/**
 * Una regla del producto impide la operación por el estado actual de los
 * datos. Se responde 409 con el mensaje como detalle, de modo que debe estar
 * escrito para el usuario. El código permite al frontend distinguir la causa
 * sin interpretar el texto.
 */
public abstract class ConflictException extends RuntimeException {

	private final String code;

	protected ConflictException(String code, String message) {
		super(message);
		this.code = code;
	}

	public String getCode() {
		return code;
	}

}
