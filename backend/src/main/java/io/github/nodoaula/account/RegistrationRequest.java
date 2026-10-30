package io.github.nodoaula.account;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Datos del formulario de registro. El frontend aplica las mismas reglas; si
 * cambian aquí, cambian allí.
 *
 * El correo no restringe el dominio. La contraseña admite entre 8 y 64
 * caracteres y, además, no más de 72 bytes: es el límite de bcrypt, que
 * Spring Security rechaza con una excepción en vez de truncar, y 64
 * caracteres con tildes o eñes pueden superarlo.
 */
public record RegistrationRequest(

		@NotBlank(message = "Escribe tu correo.")
		@Email(message = "Escribe un correo válido, como nombre@ejemplo.com.")
		@Size(max = 254, message = "El correo no puede tener más de 254 caracteres.")
		String email,

		@NotNull(message = "Escribe una contraseña.")
		@Size(min = 8, max = 64, message = "La contraseña debe tener entre 8 y 64 caracteres.")
		@MaxUtf8Bytes(value = 72,
				message = "La contraseña es demasiado larga: las tildes, eñes y otros símbolos ocupan más espacio. Usa menos caracteres.")
		String password,

		// Boolean y no boolean: si la casilla no llega, @NotNull da el mismo
		// mensaje en vez de un error de conversión.
		@NotNull(message = DATA_PROCESSING_MESSAGE)
		@AssertTrue(message = DATA_PROCESSING_MESSAGE)
		Boolean dataProcessingAuthorized) {

	static final String DATA_PROCESSING_MESSAGE =
			"Para crear la cuenta tienes que confirmar que tienes 18 años o más y autorizar el tratamiento de tus datos.";

	// El toString generado de un record imprimiría la contraseña en cualquier
	// registro o mensaje de error que incluyera este objeto.
	@Override
	public String toString() {
		return "RegistrationRequest[email=" + email + ", password=***, dataProcessingAuthorized="
				+ dataProcessingAuthorized + "]";
	}

}
