package io.github.nodoaula.shared.error;

/**
 * Un campo tiene un formato válido, pero una regla del producto que se
 * comprueba en el servicio lo rechaza. Se responde igual que un fallo de
 * Bean Validation, 400 con VALIDATION_FAILED y el error sobre el campo, para
 * que el frontend lo señale junto al campo sin distinguir de dónde vino.
 */
public class FieldValidationException extends RuntimeException {

	private final String field;

	public FieldValidationException(String field, String message) {
		super(message);
		this.field = field;
	}

	public String getField() {
		return field;
	}

}
