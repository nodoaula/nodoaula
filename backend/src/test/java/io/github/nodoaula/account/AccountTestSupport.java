package io.github.nodoaula.account;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Lo que comparten las pruebas de las cuentas. Cada prueba crea sus propias
 * cuentas e instituciones, con correos y nombres únicos, para no depender de
 * lo que haya en la base local: con un correo fijo, una cuenta creada a mano
 * con él haría fallar el registro con 409.
 */
final class AccountTestSupport {

	static final String PASSWORD = "una-contrasena-valida";

	private AccountTestSupport() {
	}

	static String uniqueEmail() {
		return "cuenta." + UUID.randomUUID().toString().substring(0, 8) + "@ejemplo.com";
	}

	/**
	 * Una institución nueva, para que la prueba no dependa de cuáles cargó la
	 * migración del SNIES. El código es negativo, que el SNIES no usa, para no
	 * chocar con la restricción única.
	 */
	static Long newInstitution(JdbcClient jdbc) {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		return jdbc.sql("insert into institutions (snies_code, name) values (?, ?) returning id")
				.param(-(suffix.hashCode() & Integer.MAX_VALUE) - 1)
				.param("Institución de la prueba " + suffix)
				.query(Long.class).single();
	}

	/** La opción «Otra», que carga la migración y la tabla solo admite una vez. */
	static Long otherInstitution(JdbcClient jdbc) {
		return jdbc.sql("select id from institutions where snies_code is null").query(Long.class).single();
	}

	static String registration(String email, String name, Long institutionId, String userType) {
		return """
				{"email":"%s","password":"%s","name":"%s","institutionId":%s,"userType":"%s",\
				"dataProcessingAuthorized":true}""".formatted(email, PASSWORD, name, institutionId, userType);
	}

	static MockHttpServletRequestBuilder register(String body) {
		return post("/api/accounts").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body);
	}

	/**
	 * Una cuenta creada antes de HU506, sin perfil, con la contraseña de
	 * {@link #PASSWORD}. authorizedAt null es una creada además antes de
	 * HU510, que nunca autorizó el tratamiento de sus datos.
	 */
	static Long accountWithoutProfile(JdbcClient jdbc, String email, Instant authorizedAt) {
		return jdbc.sql("insert into accounts (email, password_hash, created_at, data_processing_authorized_at) "
				+ "values (?, ?, now(), ?) returning id")
				.param(email)
				.param("{noop}" + PASSWORD)
				.param(authorizedAt == null ? null : Timestamp.from(authorizedAt))
				.query(Long.class).single();
	}

	/** La cuenta con sesión, como la deja el filtro de login. */
	static RequestPostProcessor signedInAs(Long accountId, String email) {
		return user(new AccountPrincipal(accountId, email, "{noop}" + PASSWORD));
	}

}
