package io.github.nodoaula.shared.error;

/**
 * La petición trae un cuerpo mayor del que el backend acepta. Se responde 413
 * antes de terminar de leerlo, para no cargarlo en memoria.
 */
public class PayloadTooLargeException extends RuntimeException {

	public PayloadTooLargeException(long maxBytes) {
		super("La petición supera el tamaño máximo de " + maxBytes + " bytes.");
	}

}
