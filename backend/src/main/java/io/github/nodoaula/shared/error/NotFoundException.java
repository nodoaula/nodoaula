package io.github.nodoaula.shared.error;

/**
 * Lo que se pide no existe. Se responde 404 con el mensaje como detalle, de
 * modo que debe estar escrito para el usuario. El código permite al frontend
 * distinguir la causa sin interpretar el texto.
 */
public abstract class NotFoundException extends RuntimeException {

	private final String code;

	protected NotFoundException(String code, String message) {
		super(message);
		this.code = code;
	}

	public String getCode() {
		return code;
	}

}
