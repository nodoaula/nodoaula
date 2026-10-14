package io.github.nodoaula.shared.error;

/**
 * Quien tiene sesión no puede hacer esa operación sobre esos datos, por una
 * regla del producto como la de autoría (ADR-007). Se responde 403 con el
 * mensaje como detalle, de modo que debe estar escrito para el usuario. El
 * código permite al frontend distinguir la causa sin interpretar el texto, y
 * no confundirla con un 403 por falta de token CSRF.
 */
public abstract class ForbiddenException extends RuntimeException {

	private final String code;

	protected ForbiddenException(String code, String message) {
		super(message);
		this.code = code;
	}

	public String getCode() {
		return code;
	}

}
