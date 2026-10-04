package io.github.nodoaula.shared.error;

/**
 * La petición no puede atenderse por lo que trae, no por el estado de los
 * datos. Se responde 400 con el mensaje como detalle, de modo que debe estar
 * escrito para el usuario. El código permite al frontend distinguir la causa
 * sin interpretar el texto.
 */
public abstract class BadRequestException extends RuntimeException {

	private final String code;

	protected BadRequestException(String code, String message) {
		super(message);
		this.code = code;
	}

	public String getCode() {
		return code;
	}

}
