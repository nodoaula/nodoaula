package io.github.nodoaula.forum;

import static io.github.nodoaula.forum.ForumTestSupport.signedInAs;
import static io.github.nodoaula.forum.ForumTestSupport.teamAccount;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

/**
 * Pruebas de HU402 sobre las respuestas: se leen sin sesión, en orden
 * cronológico y sin autor; se publican con sesión, y las retira quien las
 * publicó o una cuenta del equipo. Sobre una pregunta retirada no se hace nada.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AnswerTests {

	private static final Long ASKER_ID = 999L;
	private static final Long ANSWERER_ID = 998L;
	private static final Long OTHER_ID = 997L;
	private static final String SEED_COURSE = "Arquitectura de Software";

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;
	@Autowired private EntityManager entityManager;

	private Long questionId;

	@BeforeEach
	void publishAQuestion() throws Exception {
		Long courseId = jdbcTemplate.queryForObject("select id from courses where name = ?", Long.class, SEED_COURSE);
		String response = mockMvc.perform(post("/api/forum/questions").with(signedInAs(ASKER_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"courseId": %s, "title": "¿Cuándo se considera descargado?", "body": "Nunca llega a cero."}
						""".formatted(courseId)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		questionId = JsonPath.<Number>read(response, "$.id").longValue();
	}

	private ResultActions postAnswer(Long accountId, String jsonText) throws Exception {
		return mockMvc.perform(post("/api/forum/questions/" + questionId + "/answers").with(signedInAs(accountId))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"body\": " + jsonText + "}"));
	}

	private Long answer(Long accountId, String text) throws Exception {
		String response = postAnswer(accountId, "\"" + text + "\"")
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return JsonPath.<Number>read(response, "$.id").longValue();
	}

	private ResultActions retire(Long answerId, Long accountId) throws Exception {
		return mockMvc.perform(post("/api/forum/answers/" + answerId + "/retire").with(signedInAs(accountId))
				.with(csrf()));
	}

	// Las peticiones comparten la transacción de la prueba y su contexto de
	// persistencia: antes de leer o escribir con JDBC, se vuelca lo pendiente y
	// se olvida lo leído.
	private void syncWithDatabase() {
		entityManager.flush();
		entityManager.clear();
	}

	private String thread() {
		return "/api/forum/questions/" + questionId + "/answers";
	}

	@Test
	void publishesAnAnswerAndTheThreadIsReadWithoutASession() throws Exception {
		postAnswer(ANSWERER_ID, "\"  Después de 5τ queda menos del 1 %.  \"")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.body").value("Después de 5τ queda menos del 1 %."))
				.andExpect(jsonPath("$.createdAt").isNotEmpty())
				.andExpect(jsonPath("$.mine").value(true))
				.andExpect(jsonPath("$.canRetire").value(true))
				.andExpect(jsonPath("$.authorId").doesNotExist())
				.andExpect(jsonPath("$.email").doesNotExist());

		mockMvc.perform(get(thread()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].body").value("Después de 5τ queda menos del 1 %."))
				.andExpect(jsonPath("$[0].mine").value(false))
				.andExpect(jsonPath("$[0].canRetire").value(false))
				.andExpect(jsonPath("$[0].authorId").doesNotExist());
	}

	@Test
	void theThreadIsInChronologicalOrder() throws Exception {
		answer(ANSWERER_ID, "Primera");
		answer(OTHER_ID, "Segunda");
		answer(ANSWERER_ID, "Tercera");

		mockMvc.perform(get(thread()))
				.andExpect(jsonPath("$[0].body").value("Primera"))
				.andExpect(jsonPath("$[1].body").value("Segunda"))
				.andExpect(jsonPath("$[2].body").value("Tercera"));
	}

	@Test
	void answeringRequiresASession() throws Exception {
		mockMvc.perform(post(thread()).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"body\": \"Sin sesión\"}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	@Test
	void theAnswerIsRequiredAndHasAtMost5000Characters() throws Exception {
		// U+2003 y U+3000 son espacios Unicode: @NotBlank también los descarta.
		for (String blank : new String[] { "\"   \"", "\"\\n\\n\\t\"", "\"\\u2003\\u3000\"", "null" }) {
			postAnswer(ANSWERER_ID, blank)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.errors[0].field").value("body"));
		}
		postAnswer(ANSWERER_ID, "\"" + "a".repeat(5001) + "\"")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("body"));
		postAnswer(ANSWERER_ID, "\"" + "a".repeat(5000) + "\"")
				.andExpect(status().isCreated());
	}

	@Test
	void aQuestionThatDoesNotExistHasNoThread() throws Exception {
		mockMvc.perform(get("/api/forum/questions/999999999/answers"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
		mockMvc.perform(post("/api/forum/questions/999999999/answers").with(signedInAs(ANSWERER_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"body\": \"Texto\"}"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
	}

	@Test
	void onARetiredQuestionNothingIsReadAnsweredOrRetired() throws Exception {
		Long answerId = answer(ANSWERER_ID, "Respuesta previa");
		mockMvc.perform(post("/api/forum/questions/" + questionId + "/retire").with(signedInAs(ASKER_ID)).with(csrf()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get(thread()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
		postAnswer(ANSWERER_ID, "\"Tarde\"")
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
		retire(answerId, ANSWERER_ID)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));

		syncWithDatabase();
		assertThat(jdbcTemplate.queryForObject("select count(*) from forum_answers where retired_at is null",
				Integer.class)).isEqualTo(1);
	}

	@Test
	void theAuthorRetiresTheirAnswerAndItStopsBeingSeen() throws Exception {
		Long answerId = answer(ANSWERER_ID, "Para retirar");

		retire(answerId, ANSWERER_ID).andExpect(status().isNoContent());

		mockMvc.perform(get(thread())).andExpect(jsonPath("$", hasSize(0)));
		retire(answerId, ANSWERER_ID)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ANSWER_NOT_FOUND"));
	}

	@Test
	void nobodyElseCanRetireItAndTheApiAnswers403() throws Exception {
		Long answerId = answer(ANSWERER_ID, "Ajena");

		// Tampoco quien hizo la pregunta: retirar respuestas ajenas es moderar.
		for (Long accountId : new Long[] { OTHER_ID, ASKER_ID }) {
			retire(answerId, accountId)
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("ANSWER_CHANGE_FORBIDDEN"));
			mockMvc.perform(get(thread()).with(signedInAs(accountId)))
					.andExpect(jsonPath("$[0].mine").value(false))
					.andExpect(jsonPath("$[0].canRetire").value(false));
		}
		mockMvc.perform(get(thread())).andExpect(jsonPath("$", hasSize(1)));
	}

	@Test
	void aTeamAccountCanRetireAnyAnswer() throws Exception {
		Long answerId = answer(ANSWERER_ID, "Moderada");
		Long team = teamAccount(jdbcTemplate, "equipo.respuestas@ejemplo.com");

		mockMvc.perform(get(thread()).with(signedInAs(team)))
				.andExpect(jsonPath("$[0].mine").value(false))
				.andExpect(jsonPath("$[0].canRetire").value(true));
		retire(answerId, team).andExpect(status().isNoContent());
		mockMvc.perform(get(thread())).andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void retiringTheUsefulAnswerLeavesTheQuestionWithoutOne() throws Exception {
		Long useful = answer(ANSWERER_ID, "La útil");
		Long other = answer(OTHER_ID, "Otra");
		syncWithDatabase();
		jdbcTemplate.update("update forum_questions set useful_answer_id = ? where id = ?", useful, questionId);

		retire(other, OTHER_ID).andExpect(status().isNoContent());
		assertThat(usefulAnswerId()).isEqualTo(useful);

		retire(useful, ANSWERER_ID).andExpect(status().isNoContent());
		assertThat(usefulAnswerId()).isNull();
	}

	private Long usefulAnswerId() {
		syncWithDatabase();
		return jdbcTemplate.queryForObject("select useful_answer_id from forum_questions where id = ?", Long.class,
				questionId);
	}

	@Test
	void retiringWithoutASessionIsA401() throws Exception {
		Long answerId = answer(ANSWERER_ID, "Sin sesión para retirar");

		mockMvc.perform(post("/api/forum/answers/" + answerId + "/retire").with(csrf()))
				.andExpect(status().isUnauthorized());
	}

}
