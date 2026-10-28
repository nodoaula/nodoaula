package io.github.nodoaula.forum;

import static io.github.nodoaula.forum.ForumTestSupport.signedInAs;
import static io.github.nodoaula.forum.ForumTestSupport.teamAccount;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 * Pruebas de HU402 sobre la respuesta útil: solo quien hizo la pregunta la
 * marca, una a la vez, y puede cambiarla o quitarla. Tiene que ser una
 * respuesta visible de la misma pregunta.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UsefulAnswerTests {

	private static final Long ASKER_ID = 999L;
	private static final Long ANSWERER_ID = 998L;
	private static final Long OTHER_ID = 997L;
	private static final String SEED_COURSE = "Arquitectura de Software";

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long courseId;
	private Long questionId;

	@BeforeEach
	void publishAQuestion() throws Exception {
		courseId = jdbcTemplate.queryForObject("select id from courses where name = ?", Long.class, SEED_COURSE);
		questionId = question(ASKER_ID);
	}

	private Long question(Long accountId) throws Exception {
		return idOf(mockMvc.perform(post("/api/forum/questions").with(signedInAs(accountId)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"courseId\": %s, \"title\": \"Pregunta\", \"body\": \"Texto.\"}".formatted(courseId)))
				.andExpect(status().isCreated()));
	}

	private Long answer(Long question, Long accountId) throws Exception {
		return idOf(mockMvc.perform(post("/api/forum/questions/" + question + "/answers").with(signedInAs(accountId))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"body\": \"Respuesta.\"}"))
				.andExpect(status().isCreated()));
	}

	private static Long idOf(ResultActions result) throws Exception {
		return JsonPath.<Number>read(result.andReturn().getResponse().getContentAsString(), "$.id").longValue();
	}

	private ResultActions mark(Long accountId, String answerIdJson) throws Exception {
		return mockMvc.perform(put(useful()).with(signedInAs(accountId)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"answerId\": " + answerIdJson + "}"));
	}

	private ResultActions unmark(Long accountId) throws Exception {
		return mockMvc.perform(delete(useful()).with(signedInAs(accountId)).with(csrf()));
	}

	private String useful() {
		return "/api/forum/questions/" + questionId + "/useful-answer";
	}

	private ResultActions viewQuestion() throws Exception {
		return mockMvc.perform(get("/api/forum/questions/" + questionId));
	}

	@Test
	void theAskerMarksAnAnswerAndEveryoneSeesIt() throws Exception {
		Long answerId = answer(questionId, ANSWERER_ID);

		mark(ASKER_ID, answerId.toString()).andExpect(status().isNoContent());

		viewQuestion()
				.andExpect(jsonPath("$.usefulAnswerId").value(answerId))
				.andExpect(jsonPath("$.canMarkUseful").value(false));
		mockMvc.perform(get("/api/forum/questions/" + questionId).with(signedInAs(ASKER_ID)))
				.andExpect(jsonPath("$.canMarkUseful").value(true));
		mockMvc.perform(get("/api/forum/questions").param("courseId", courseId.toString()))
				.andExpect(jsonPath("$[0].usefulAnswerId").value(answerId));
	}

	@Test
	void thereIsOnlyOneAndTheAskerCanChangeItOrRemoveIt() throws Exception {
		Long first = answer(questionId, ANSWERER_ID);
		Long second = answer(questionId, OTHER_ID);
		viewQuestion().andExpect(jsonPath("$.usefulAnswerId").doesNotExist());

		mark(ASKER_ID, first.toString()).andExpect(status().isNoContent());
		mark(ASKER_ID, second.toString()).andExpect(status().isNoContent());
		viewQuestion().andExpect(jsonPath("$.usefulAnswerId").value(second));

		unmark(ASKER_ID).andExpect(status().isNoContent());
		viewQuestion().andExpect(jsonPath("$.usefulAnswerId").doesNotExist());
		unmark(ASKER_ID).andExpect(status().isNoContent());
	}

	@Test
	void nobodyElseCanMarkOrRemoveItAndTheApiAnswers403() throws Exception {
		Long answerId = answer(questionId, ANSWERER_ID);
		mark(ASKER_ID, answerId.toString()).andExpect(status().isNoContent());
		Long team = teamAccount(jdbcTemplate, "equipo.util@ejemplo.com");

		// Ni quien escribió la respuesta ni el equipo: la útil es para quien preguntó.
		for (Long accountId : new Long[] { OTHER_ID, ANSWERER_ID, team }) {
			mark(accountId, answerId.toString())
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("USEFUL_ANSWER_FORBIDDEN"));
			unmark(accountId)
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("USEFUL_ANSWER_FORBIDDEN"));
			mockMvc.perform(get("/api/forum/questions/" + questionId).with(signedInAs(accountId)))
					.andExpect(jsonPath("$.canMarkUseful").value(false));
		}
		viewQuestion().andExpect(jsonPath("$.usefulAnswerId").value(answerId));
	}

	@Test
	void markingOrRemovingRequiresASession() throws Exception {
		Long answerId = answer(questionId, ANSWERER_ID);

		mockMvc.perform(put(useful()).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"answerId\": " + answerId + "}"))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(delete(useful()).with(csrf()))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void itMustBeAVisibleAnswerOfTheSameQuestion() throws Exception {
		Long retired = answer(questionId, ANSWERER_ID);
		mockMvc.perform(post("/api/forum/answers/" + retired + "/retire").with(signedInAs(ANSWERER_ID)).with(csrf()))
				.andExpect(status().isNoContent());
		Long fromAnotherQuestion = answer(question(OTHER_ID), ANSWERER_ID);

		for (Long answerId : new Long[] { retired, fromAnotherQuestion, 999999999L }) {
			mark(ASKER_ID, answerId.toString())
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.errors[0].field").value("answerId"));
		}
		mark(ASKER_ID, "null")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("answerId"))
				.andExpect(jsonPath("$.errors[0].message").value("Elige la respuesta útil."));
		viewQuestion().andExpect(jsonPath("$.usefulAnswerId").doesNotExist());
	}

	@Test
	void onARetiredOrMissingQuestionNothingIsMarked() throws Exception {
		Long answerId = answer(questionId, ANSWERER_ID);
		mockMvc.perform(post("/api/forum/questions/" + questionId + "/retire").with(signedInAs(ASKER_ID)).with(csrf()))
				.andExpect(status().isNoContent());

		mark(ASKER_ID, answerId.toString())
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
		unmark(ASKER_ID)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));

		questionId = 999999999L;
		mark(ASKER_ID, answerId.toString()).andExpect(status().isNotFound());
		unmark(ASKER_ID).andExpect(status().isNotFound());
	}

}
