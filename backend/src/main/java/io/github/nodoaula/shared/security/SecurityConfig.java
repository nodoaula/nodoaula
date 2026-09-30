package io.github.nodoaula.shared.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.savedrequest.NullRequestCache;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

@Configuration
class SecurityConfig {

	/**
	 * POST inicia sesión, DELETE la cierra y GET dice de quién es. Los dos
	 * primeros los atienden los filtros del framework; el GET, un controlador
	 * del módulo account.
	 */
	private static final String SESSION_URL = "/api/session";

	/**
	 * @param loginSuccessHandler lo aporta el módulo account, que es el que
	 *        sabe qué devolver de la cuenta que acaba de entrar
	 */
	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityErrorHandler errorHandler,
			AuthenticationSuccessHandler loginSuccessHandler) {
		http
				.authorizeHttpRequests(requests -> requests
						// Sin esto, un error dentro de una petición pública
						// se reenvía a /error y el cliente recibe un 401 en
						// lugar del error real.
						.requestMatchers("/error").permitAll()

						// El catálogo se consulta sin cuenta; la cuenta hace
						// falta para aportar.
						.requestMatchers(HttpMethod.GET, "/api/resources", "/api/resources/**").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/health", "/api/csrf").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/accounts").permitAll()

						// El health check de Render y la tarea programada que
						// mantiene activa la base de datos llaman sin sesión.
						.requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**").permitAll()

						// Iniciar y cerrar sesión no necesitan regla: sus
						// filtros responden antes de que se compruebe el
						// acceso. GET /api/session sí queda protegido.
						.anyRequest().authenticated())

				// Activa también para las peticiones públicas que modifican
				// datos, como el registro y el inicio de sesión.
				.csrf(csrf -> csrf.spa().csrfTokenRepository(csrfTokenRepository()))

				// El filtro de login del framework, y no un controlador propio,
				// porque guarda el contexto de seguridad en la sesión y renueva
				// su identificador al autenticarse. Lee un formulario
				// (email, password), no JSON. Responde 200 o 401 sin
				// redirigir: la redirección que hace por defecto acabaría, por
				// la reescritura del sitio estático, en el HTML del frontend.
				// Declarar loginPage apaga además la página de login que
				// Spring genera; el GET de esa ruta es el del controlador.
				.formLogin(form -> form
						.loginPage(SESSION_URL)
						.loginProcessingUrl(SESSION_URL)
						.usernameParameter("email")
						.passwordParameter("password")
						.successHandler(loginSuccessHandler)
						.failureHandler(errorHandler))

				// Invalida la sesión, que se borra de la base de datos, y
				// responde 204 sin redirigir. Exige el token CSRF, como
				// cualquier DELETE.
				.logout(logout -> logout
						.logoutRequestMatcher(PathPatternRequestMatcher.withDefaults()
								.matcher(HttpMethod.DELETE, SESSION_URL))
						.logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))

				// Por defecto, una petición rechazada por falta de sesión se
				// guarda en una sesión nueva para repetirla tras el login. Una
				// API no la repite, y cada visitante anónimo dejaría una fila
				// en la tabla de sesiones.
				.requestCache(cache -> cache.requestCache(new NullRequestCache()))

				// Una petición sin sesión responde 401 en vez de redirigir a
				// la página de login.
				.exceptionHandling(exceptions -> exceptions
						.authenticationEntryPoint(errorHandler)
						.accessDeniedHandler(errorHandler));

		return http.build();
	}

	/**
	 * El token viaja en la cookie XSRF-TOKEN, legible por el frontend para que
	 * lo copie en el encabezado X-XSRF-TOKEN. Sale Secure cuando la petición
	 * llega por https, que en Render depende de server.forward-headers-strategy.
	 * Se renueva al iniciar y al cerrar sesión.
	 */
	private static CookieCsrfTokenRepository csrfTokenRepository() {
		CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
		repository.setCookieCustomizer(cookie -> cookie.sameSite("Lax"));
		return repository;
	}

	/**
	 * Delegante y no bcrypt directamente: el hash guarda el algoritmo como
	 * prefijo, y así podría cambiarse sin invalidar las contraseñas existentes.
	 */
	@Bean
	PasswordEncoder passwordEncoder() {
		return PasswordEncoderFactories.createDelegatingPasswordEncoder();
	}

}
