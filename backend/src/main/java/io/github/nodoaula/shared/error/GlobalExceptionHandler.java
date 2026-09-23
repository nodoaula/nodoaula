package io.github.nodoaula.shared.error;

import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Único sitio donde un error se convierte en respuesta, siempre como
 * ProblemDetail. Los rechazos de Spring Security también llegan aquí, desde
 * shared/security, para que el frontend los interprete todos igual.
 *
 * La propiedad {@code code} es la que el frontend compara; el título y el
 * detalle son texto para el usuario y pueden cambiar.
 */
@RestControllerAdvice
class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(
			MethodArgumentNotValidException exception,
			HttpHeaders headers,
			HttpStatusCode status,
			WebRequest request) {

		List<FieldErrorDto> errors = exception.getBindingResult().getFieldErrors().stream()
				.map(error -> new FieldErrorDto(error.getField(), error.getDefaultMessage()))
				.toList();

		ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
				"Datos no válidos", "Revisa los campos marcados.");
		problem.setProperty("errors", errors);

		return ResponseEntity.badRequest().body(problem);
	}

	@Override
	protected ResponseEntity<Object> handleHttpMessageNotReadable(
			HttpMessageNotReadableException exception,
			HttpHeaders headers,
			HttpStatusCode status,
			WebRequest request) {

		return ResponseEntity.badRequest().body(problem(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST",
				"Petición mal formada", "El cuerpo de la petición no es un JSON válido."));
	}

	@ExceptionHandler(ConflictException.class)
	ProblemDetail handleConflict(ConflictException exception) {
		return problem(HttpStatus.CONFLICT, exception.getCode(), "Conflicto", exception.getMessage());
	}

	// El mismo mensaje para un correo sin cuenta y para una contraseña
	// incorrecta: distinguirlos revelaría qué correos están registrados
	// (ADR-007). Spring Security ya entrega los dos casos como esta excepción.
	@ExceptionHandler(BadCredentialsException.class)
	ProblemDetail handleBadCredentials(BadCredentialsException exception) {
		return problem(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
				"Credenciales incorrectas", "El correo o la contraseña no son correctos.");
	}

	// Un fallo al buscar la cuenta, como la base de datos caída, llega al
	// filtro de login envuelto en esta excepción. No es culpa del usuario, y
	// responderle 401 le haría creer que se equivocó de contraseña.
	@ExceptionHandler(InternalAuthenticationServiceException.class)
	ProblemDetail handleAuthenticationServiceFailure(InternalAuthenticationServiceException exception) {
		logger.error("No se pudo comprobar las credenciales", exception);
		return problem(HttpStatus.INTERNAL_SERVER_ERROR, "AUTHENTICATION_UNAVAILABLE",
				"Inicio de sesión no disponible",
				"No se pudo iniciar sesión por un error del servidor. Inténtalo de nuevo en unos minutos.");
	}

	@ExceptionHandler(AuthenticationException.class)
	ProblemDetail handleAuthentication(AuthenticationException exception) {
		return problem(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED",
				"Sesión requerida", "Inicia sesión para continuar.");
	}

	// Va antes que el de AccessDeniedException por ser más específico. Se
	// distingue porque un 403 por falta de token se arregla recargando la
	// página, y uno por permisos no.
	@ExceptionHandler(CsrfException.class)
	ProblemDetail handleCsrf(CsrfException exception) {
		return problem(HttpStatus.FORBIDDEN, "CSRF_TOKEN_INVALID",
				"Token de seguridad no válido",
				"La petición no incluye un token de seguridad válido. Recarga la página e inténtalo de nuevo.");
	}

	@ExceptionHandler(AccessDeniedException.class)
	ProblemDetail handleAccessDenied(AccessDeniedException exception) {
		return problem(HttpStatus.FORBIDDEN, "ACCESS_DENIED",
				"Acceso denegado", "No tienes permiso para realizar esta operación.");
	}

	private static ProblemDetail problem(HttpStatus status, String code, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		problem.setProperty("code", code);
		return problem;
	}

	/** Error de un campo concreto, para señalarlo junto al campo en el formulario. */
	record FieldErrorDto(String field, String message) {
	}

}
