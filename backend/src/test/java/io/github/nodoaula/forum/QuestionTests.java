package io.github.nodoaula.forum;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

/**
 * Pruebas de HU401: publicar una pregunta en el foro de un curso, leerla sin
 * sesión y retirarla. Quien publica o una cuenta del equipo la retira; nadie
 * más (403), y una pregunta retirada deja de verse.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class QuestionTests {

	private static final Long AUTHOR_ID = 999L;
	private static final Long OTHER_ID = 998L;
	private static final String SEED_COURSE = "Arquitectura de Software";
	private static final String SEED_RESOURCE = "Spring Boot 2026-2";
	private static final String OTHER_COURSE = "Gestión de proyectos";

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long courseId;
	private Long otherCourseId;
	private Long resourceId;

	@BeforeEach
	void findSeedData() {
		courseId = idOf("courses", "name", SEED_COURSE);
		otherCourseId = idOf("courses", "name", OTHER_COURSE);
		resourceId = idOf("resources", "title", SEED_RESOURCE);
	}

	private Long idOf(String table, String column, String value) {
		return jdbcTemplate.queryForObject("select id from " + table + " where " + column + " = ?", Long.class, value);
	}

	private static RequestPostProcessor signedInAs(Long accountId) {
		return authentication(new UsernamePasswordAuthenticationToken(new TestAccount(accountId), null, List.of()));
	}

	// La marca de equipo solo se pone en la base de datos (ADR-007).
	private Long teamAccount() {
		return jdbcTemplate.queryForObject(
				"insert into accounts (email, password_hash, created_at, team_member) "
						+ "values ('equipo.foro@ejemplo.com', '{noop}sin-uso', now(), true) returning id",
				Long.class);
	}

	private static String body(Long courseId, Long resourceId, String title, String text) {
		return """
				{"courseId": %s, "resourceId": %s, "title": "%s", "body": "%s"}
				""".formatted(courseId, resourceId, title, text);
	}

	private Long publish(Long accountId, String title) throws Exception {
		String response = mockMvc.perform(post("/api/forum/questions").with(signedInAs(accountId)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(courseId, null, title, "Texto de la pregunta.")))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return JsonPath.<Number>read(response, "$.id").longValue();
	}

	@Test
	void publishesAQuestionOfACourseAndItAppearsInItsForum() throws Exception {
		mockMvc.perform(post("/api/forum/questions").with(signedInAs(AUTHOR_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(courseId, null, "  ¿Cómo se configura Spring?  ", "  Me falta el paso inicial.  ")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.courseId").value(courseId))
				.andExpect(jsonPath("$.resourceId").doesNotExist())
				.andExpect(jsonPath("$.title").value("¿Cómo se configura Spring?"))
				.andExpect(jsonPath("$.body").value("Me falta el paso inicial."))
				.andExpect(jsonPath("$.createdAt").isNotEmpty())
				.andExpect(jsonPath("$.authorId").doesNotExist())
				.andExpect(jsonPath("$.email").doesNotExist());

		mockMvc.perform(get("/api/forum/questions").param("courseId", courseId.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].title").value("¿Cómo se configura Spring?"));
	}

	@Test
	void aQuestionCanBeAboutAResourceOfTheCourse() throws Exception {
		mockMvc.perform(post("/api/forum/questions").with(signedInAs(AUTHOR_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(courseId, resourceId, "Duda del video", "Minuto 4.")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.resourceId").value(resourceId));
	}

	@Test
	void theForumIsReadWithoutASessionButNotWrittenWithout() throws Exception {
		publish(AUTHOR_ID, "Pregunta visible");

		mockMvc.perform(get("/api/forum/questions").param("courseId", courseId.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].canRetire").value(false));

		mockMvc.perform(post("/api/forum/questions").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(courseId, null, "Sin sesión", "No debe publicarse.")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	@Test
	void theTitleAndTheBodyCannotBeEmpty() throws Exception {
		mockMvc.perform(post("/api/forum/questions").with(signedInAs(AUTHOR_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(courseId, null, "   ", "")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors", hasSize(2)));
	}

	@Test
	void aCourseThatDoesNotExistIsRejectedOnItsField() throws Exception {
		mockMvc.perform(post("/api/forum/questions").with(signedInAs(AUTHOR_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(999999999L, null, "Título", "Texto.")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[0].field").value("courseId"));
	}

	@Test
	void aResourceFromAnotherCourseIsRejectedOnItsField() throws Exception {
		mockMvc.perform(post("/api/forum/questions").with(signedInAs(AUTHOR_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(otherCourseId, resourceId, "Título", "Texto.")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("resourceId"));
	}

	@Test
	void theAuthorRetiresItAndItStopsBeingSeen() throws Exception {
		Long id = publish(AUTHOR_ID, "Para retirar");

		mockMvc.perform(get("/api/forum/questions").param("courseId", courseId.toString()).with(signedInAs(AUTHOR_ID)))
				.andExpect(jsonPath("$[0].canRetire").value(true));

		mockMvc.perform(post("/api/forum/questions/" + id + "/retire").with(signedInAs(AUTHOR_ID)).with(csrf()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/forum/questions").param("courseId", courseId.toString()))
				.andExpect(jsonPath("$", hasSize(0)));
		mockMvc.perform(get("/api/forum/questions/" + id))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
		mockMvc.perform(post("/api/forum/questions/" + id + "/retire").with(signedInAs(AUTHOR_ID)).with(csrf()))
				.andExpect(status().isNotFound());
	}

	@Test
	void anotherAccountCannotRetireItAndTheApiAnswers403() throws Exception {
		Long id = publish(AUTHOR_ID, "Ajena");

		mockMvc.perform(post("/api/forum/questions/" + id + "/retire").with(signedInAs(OTHER_ID)).with(csrf()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("QUESTION_CHANGE_FORBIDDEN"));

		mockMvc.perform(get("/api/forum/questions").param("courseId", courseId.toString()).with(signedInAs(OTHER_ID)))
				.andExpect(jsonPath("$[0].canRetire").value(false));
		mockMvc.perform(get("/api/forum/questions/" + id)).andExpect(status().isOk());
	}

	@Test
	void aTeamAccountCanRetireAnyQuestion() throws Exception {
		Long id = publish(AUTHOR_ID, "Moderada");
		Long team = teamAccount();

		mockMvc.perform(get("/api/forum/questions/" + id).with(signedInAs(team)))
				.andExpect(jsonPath("$.canRetire").value(true));
		mockMvc.perform(post("/api/forum/questions/" + id + "/retire").with(signedInAs(team)).with(csrf()))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/forum/questions/" + id)).andExpect(status().isNotFound());
	}

	@Test
	void retiringWithoutASessionIsA401() throws Exception {
		Long id = publish(AUTHOR_ID, "Sin sesión para retirar");

		mockMvc.perform(post("/api/forum/questions/" + id + "/retire").with(csrf()))
				.andExpect(status().isUnauthorized());
	}

	/**
	 * Hace de cuenta con sesión iniciada. El controlador lee el autor con
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
