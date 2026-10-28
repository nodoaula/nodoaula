package io.github.nodoaula.forum;

import static io.github.nodoaula.forum.ForumTestSupport.signedInAs;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

/**
 * Los retiros del foro y la marca de respuesta útil quedan guardados. Sin la transacción de la prueba a
 * propósito: con ella, un servicio sin @Transactional pasaría las demás
 * pruebas sin guardar nada. Por eso borra lo que crea.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ForumPersistenceTests {

	private static final Long ASKER_ID = 999L;
	private static final Long ANSWERER_ID = 998L;
	private static final String SEED_COURSE = "Gestión de proyectos";

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long questionId;

	@AfterEach
	void deleteWhatWasCreated() {
		if (questionId == null) {
			return;
		}
		jdbcTemplate.update("update forum_questions set useful_answer_id = null where id = ?", questionId);
		jdbcTemplate.update("delete from forum_answers where question_id = ?", questionId);
		jdbcTemplate.update("delete from forum_questions where id = ?", questionId);
	}

	private Long idOf(String response) {
		return JsonPath.<Number>read(response, "$.id").longValue();
	}

	private void publishAQuestion() throws Exception {
		Long courseId = jdbcTemplate.queryForObject("select id from courses where name = ?", Long.class, SEED_COURSE);
		questionId = idOf(mockMvc.perform(post("/api/forum/questions").with(signedInAs(ASKER_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"courseId\": %s, \"title\": \"Pregunta\", \"body\": \"Texto.\"}".formatted(courseId)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString());
	}

	private Long publishAnAnswer() throws Exception {
		return idOf(mockMvc.perform(post("/api/forum/questions/" + questionId + "/answers")
				.with(signedInAs(ANSWERER_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"body\": \"Respuesta.\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString());
	}

	private Long usefulAnswerId() {
		return jdbcTemplate.queryForObject("select useful_answer_id from forum_questions where id = ?", Long.class,
				questionId);
	}

	@Test
	void markingAndRemovingTheUsefulAnswerIsSaved() throws Exception {
		publishAQuestion();
		Long answerId = publishAnAnswer();
		String useful = "/api/forum/questions/" + questionId + "/useful-answer";

		mockMvc.perform(put(useful).with(signedInAs(ASKER_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"answerId\": " + answerId + "}"))
				.andExpect(status().isNoContent());
		assertThat(usefulAnswerId()).isEqualTo(answerId);

		mockMvc.perform(delete(useful).with(signedInAs(ASKER_ID)).with(csrf()))
				.andExpect(status().isNoContent());
		assertThat(usefulAnswerId()).isNull();
	}

	@Test
	void retiringAQuestionIsSavedWithWhoRetiredIt() throws Exception {
		publishAQuestion();

		mockMvc.perform(post("/api/forum/questions/" + questionId + "/retire").with(signedInAs(ASKER_ID)).with(csrf()))
				.andExpect(status().isNoContent());

		Map<String, Object> question = jdbcTemplate.queryForMap(
				"select retired_at, retired_by from forum_questions where id = ?", questionId);
		assertThat(question.get("retired_at")).isNotNull();
		assertThat(question.get("retired_by")).isEqualTo(ASKER_ID);
	}

	@Test
	void retiringTheUsefulAnswerIsSavedWithWhoRetiredItAndClearsTheUsefulOne() throws Exception {
		publishAQuestion();
		Long answerId = publishAnAnswer();
		jdbcTemplate.update("update forum_questions set useful_answer_id = ? where id = ?", answerId, questionId);

		mockMvc.perform(post("/api/forum/answers/" + answerId + "/retire").with(signedInAs(ANSWERER_ID)).with(csrf()))
				.andExpect(status().isNoContent());

		Map<String, Object> answer = jdbcTemplate.queryForMap(
				"select retired_at, retired_by from forum_answers where id = ?", answerId);
		assertThat(answer.get("retired_at")).isNotNull();
		assertThat(answer.get("retired_by")).isEqualTo(ANSWERER_ID);
		assertThat(usefulAnswerId()).isNull();
	}

}
