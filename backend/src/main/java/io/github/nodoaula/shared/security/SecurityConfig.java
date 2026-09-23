package io.github.nodoaula.shared.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

@Configuration
class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityErrorHandler errorHandler) {
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

						.anyRequest().authenticated())

				// Activa también para las peticiones públicas que modifican
				// datos, como el registro.
				.csrf(csrf -> csrf.spa().csrfTokenRepository(csrfTokenRepository()))

				// No se configura formLogin ni httpBasic: sin ellos, una
				// petición sin sesión responde 401 en vez de redirigir a una
				// página de login que, por la reescritura del sitio estático,
				// acabaría devolviendo el HTML del frontend.
				.exceptionHandling(exceptions -> exceptions
						.authenticationEntryPoint(errorHandler)
						.accessDeniedHandler(errorHandler));

		return http.build();
	}

	/**
	 * El token viaja en la cookie XSRF-TOKEN, legible por el frontend para que
	 * lo copie en el encabezado X-XSRF-TOKEN. Sale Secure cuando la petición
	 * llega por https, que en Render depende de server.forward-headers-strategy.
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
