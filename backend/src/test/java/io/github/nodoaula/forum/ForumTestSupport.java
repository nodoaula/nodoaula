package io.github.nodoaula.forum;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Lo que comparten las pruebas del foro: la cuenta con sesión, la del equipo y
 * cómo encontrar en una lista lo que creó la prueba.
 */
final class ForumTestSupport {

	private ForumTestSupport() {
	}

	/**
	 * El elemento de una lista JSON con ese identificador, como expresión de
	 * JsonPath. Las pruebas miran solo lo que crean, no el tamaño de la lista,
	 * que incluye lo que ya hubiera en el foro del curso.
	 */
	static String withId(Long id) {
		return "$[?(@.id == " + id + ")]";
	}

	static RequestPostProcessor signedInAs(Long accountId) {
		return authentication(new UsernamePasswordAuthenticationToken(new TestAccount(accountId), null, List.of()));
	}

	// La marca solo se pone en la base de datos, como en el entorno desplegado:
	// no hay pantalla ni endpoint para ponerla.
	static Long teamAccount(JdbcTemplate jdbcTemplate, String email) {
		return jdbcTemplate.queryForObject(
				"insert into accounts (email, password_hash, created_at, team_member) "
						+ "values (?, '{noop}sin-uso', now(), true) returning id",
				Long.class, email);
	}

	/**
	 * Hace de cuenta con sesión iniciada. Los controladores leen la cuenta con
	 * @AuthenticationPrincipal(expression = "id"), por reflexión.
	 */
	public static final class TestAccount {

		private final Long id;

		TestAccount(Long id) {
			this.id = id;
		}

		public Long getId() {
			return id;
		}

	}

}
