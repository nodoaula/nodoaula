package io.github.nodoaula.account;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Rechaza con 429 un inicio de sesión mientras su correo está en espera, sin
 * comprobar la contraseña y sin retener la petición: una retenida ocuparía un
 * hilo durante toda la espera, y en la instancia gratuita unas pocas bastarían
 * para degradar el servicio (ADR-007).
 *
 * Va en la cadena de Spring Security justo antes del filtro de login, que sigue
 * siendo el que inicia la sesión: así una petición sin token CSRF ya se rechazó
 * y no cuenta. SecurityConfig lo coloca ahí.
 */
@Component
class LoginThrottleFilter extends OncePerRequestFilter {

	// Lo mismo que atiende el filtro de login, configurado en SecurityConfig.
	private static final RequestMatcher LOGIN = PathPatternRequestMatcher.withDefaults()
			.matcher(HttpMethod.POST, "/api/session");

	private final LoginAttemptService loginAttempts;
	private final HandlerExceptionResolver resolver;

	LoginThrottleFilter(LoginAttemptService loginAttempts,
			@Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) {
		this.loginAttempts = loginAttempts;
		this.resolver = resolver;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !LOGIN.matches(request);
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {

		long retryAfterSeconds;
		try {
			retryAfterSeconds = loginAttempts.claimAttempt(submittedEmail(request));
		} catch (DataAccessException exception) {
			// Sin poder comprobar el límite no se deja pasar, y se responde lo
			// mismo que si fallara la búsqueda de la cuenta.
			resolver.resolveException(request, response, null,
					new InternalAuthenticationServiceException("No se pudo comprobar el límite de intentos", exception));
			return;
		}

		if (retryAfterSeconds > 0) {
			resolver.resolveException(request, response, null, new TooManyLoginAttemptsException(retryAfterSeconds));
			return;
		}
		chain.doFilter(request, response);
	}

	// El mismo correo que busca el filtro de login, que lo recorta con trim y
	// quita también los caracteres de control. Si aquí no se recortaran, bastaría
	// con anteponer uno para contar como un correo distinto y esquivar el límite.
	private static String submittedEmail(HttpServletRequest request) {
		String email = request.getParameter("email");
		return email == null ? "" : email.trim();
	}

}
