package io.github.nodoaula.studygroup;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.List;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Lo que comparten las pruebas de los grupos: la cuenta con sesión, la del
 * equipo, el curso de la semilla y la petición de crear un grupo.
 */
final class StudyGroupTestSupport {

	static final String SEED_COURSE = "Arquitectura de Software";
	static final String OTHER_COURSE = "Gestión de proyectos";

	private StudyGroupTestSupport() {
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

	static Long courseId(JdbcTemplate jdbcTemplate, String name) {
		return jdbcTemplate.queryForObject("select id from courses where name = ?", Long.class, name);
	}

	/**
	 * El nombre con un sufijo único. La base local tiene lo que se haya creado
	 * a mano en los cursos de la semilla: sin el sufijo, un grupo con el mismo
	 * nombre haría responder 409 a la prueba.
	 */
	static String unique(String name) {
		return name + " " + UUID.randomUUID().toString().substring(0, 8);
	}

	/**
	 * El elemento de una lista JSON con ese identificador, como expresión de
	 * JsonPath. Las pruebas miran solo lo que crean, no el tamaño de la lista,
	 * que incluye lo que ya hubiera en el curso.
	 */
	static String withId(Long id) {
		return "$[?(@.id == " + id + ")]";
	}

	/** La petición de crear un grupo; `description` null la deja fuera del JSON. */
	static MockHttpServletRequestBuilder create(Long accountId, Long courseId, String name, String description) {
		String descriptionField = description == null ? "" : ", \"description\": \"%s\"".formatted(description);
		return post("/api/study-groups").with(signedInAs(accountId)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"courseId\": %s, \"name\": \"%s\"%s}".formatted(courseId, name, descriptionField));
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
