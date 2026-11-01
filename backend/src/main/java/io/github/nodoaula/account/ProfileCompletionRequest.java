package io.github.nodoaula.account;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Datos con que una cuenta creada antes de HU506 completa su perfil al volver
 * a iniciar sesión. El frontend aplica las mismas reglas; si cambian aquí,
 * cambian allí.
 *
 * Lleva la autorización porque la política cambia de finalidad al mostrar
 * estos datos junto a lo que la cuenta aporta, y hay que pedirla de nuevo
 * (Decreto 1377 de 2013, art. 5).
 */
public record ProfileCompletionRequest(

		@NotBlank(message = NAME_REQUIRED)
		@Size(max = NAME_MAX_LENGTH, message = NAME_TOO_LONG)
		String name,

		@NotNull(message = INSTITUTION_REQUIRED)
		Long institutionId,

		@NotNull(message = USER_TYPE_REQUIRED)
		UserType userType,

		// Boolean y no boolean, como en el registro: si la casilla no llega,
		// @NotNull da el mismo mensaje en vez de un error de conversión.
		@NotNull(message = DATA_PROCESSING_MESSAGE)
		@AssertTrue(message = DATA_PROCESSING_MESSAGE)
		Boolean dataProcessingAuthorized) {

	static final int NAME_MAX_LENGTH = 100;

	static final String NAME_REQUIRED = "Escribe tu nombre.";
	static final String NAME_TOO_LONG = "El nombre no puede tener más de 100 caracteres.";
	static final String INSTITUTION_REQUIRED = "Elige tu institución de la lista.";
	static final String USER_TYPE_REQUIRED = "Elige si eres estudiante o docente.";

	static final String DATA_PROCESSING_MESSAGE =
			"Para continuar tienes que confirmar que tienes 18 años o más y autorizar el tratamiento de tus datos según la política vigente.";

}
