package io.github.nodoaula.forum;

import static io.github.nodoaula.forum.ForumTestSupport.signedInAs;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.jayway.jsonpath.JsonPath;

/**
 * Los retiros del foro y la marca de respuesta útil quedan guardados, también
 * cuando dos escrituras sobre la misma pregunta coinciden. Sin la transacción
 * de la prueba a propósito: con ella, un servicio sin @Transactional pasaría
 * las demás pruebas sin guardar nada, y no habría dos transacciones que se
 * crucen. Por eso borra lo que crea.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ForumPersistenceTests {

	private static final Long ASKER_ID = 999L;
	private static final Long ANSWERER_ID = 998L;
	private static final Long TEAM_ID = 996L;
	private static final String SEED_COURSE = "Gestión de proyectos";

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;
	@Autowired private PlatformTransactionManager transactionManager;

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
		mockMvc.perform(put(usefulAnswerPath()).with(signedInAs(ASKER_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"answerId\": " + answerId + "}"))
				.andExpect(status().isNoContent());
		assertThat(usefulAnswerId()).isEqualTo(answerId);

		mockMvc.perform(delete(usefulAnswerPath()).with(signedInAs(ASKER_ID)).with(csrf()))
				.andExpect(status().isNoContent());
		assertThat(usefulAnswerId()).isNull();
	}

	private String usefulAnswerPath() {
		return "/api/forum/questions/" + questionId + "/useful-answer";
	}

	private int whileAnotherWriteHoldsTheQuestion(Callable<ResultActions> request, Runnable concurrentChange)
			throws Exception {
		return whileAnotherWriteHolds("forum_questions", questionId, request, concurrentChange);
	}

	/**
	 * Hace la petición mientras otra escritura en curso tiene bloqueada una
	 * fila. Cuando la petición queda esperando a esa escritura, esta hace su
	 * cambio y confirma. Devuelve el estado HTTP de la petición.
	 */
	private int whileAnotherWriteHolds(String table, Long rowId, Callable<ResultActions> request,
			Runnable concurrentChange) throws Exception {
		try (ExecutorService executor = Executors.newSingleThreadExecutor()) {
			Future<ResultActions> response = new TransactionTemplate(transactionManager).execute(status -> {
				jdbcTemplate.queryForObject("select id from " + table + " where id = ? for update", Long.class, rowId);
				Integer holder = jdbcTemplate.queryForObject("select pg_backend_pid()", Integer.class);
				Future<ResultActions> pending = executor.submit(request);
				// Solo cuenta una espera por esta transacción, no cualquiera de la base.
				// Awaitility consulta desde otro hilo, con otra conexión: de ahí el pid.
				await().atMost(Duration.ofSeconds(5)).until(() -> jdbcTemplate.queryForObject(
						"select count(*) from pg_locks where not granted and ? = any(pg_blocking_pids(pid))",
						Integer.class, holder) > 0);
				concurrentChange.run();
				return pending;
			});
			return response.get(10, TimeUnit.SECONDS).andReturn().getResponse().getStatus();
		}
	}

	@Test
	void markingTheUsefulAnswerWaitsForARetirementInProgressAndDoesNotUndoIt() throws Exception {
		publishAQuestion();
		Long answerId = publishAnAnswer();

		int status = whileAnotherWriteHoldsTheQuestion(
				() -> mockMvc.perform(put(usefulAnswerPath()).with(signedInAs(ASKER_ID)).with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"answerId\": " + answerId + "}")),
				() -> jdbcTemplate.update("update forum_questions set retired_at = now(), retired_by = ? where id = ?",
						TEAM_ID, questionId));

		assertThat(status).isEqualTo(404);
		Map<String, Object> question = jdbcTemplate.queryForMap(
				"select retired_at, useful_answer_id from forum_questions where id = ?", questionId);
		assertThat(question.get("retired_at")).isNotNull();
		assertThat(question.get("useful_answer_id")).isNull();
	}

	@Test
	void retiringAnAnswerWaitsForAMarkInProgressAndThenClearsIt() throws Exception {
		publishAQuestion();
		Long answerId = publishAnAnswer();

		int status = whileAnotherWriteHoldsTheQuestion(
				() -> mockMvc.perform(post("/api/forum/answers/" + answerId + "/retire").with(signedInAs(ANSWERER_ID))
						.with(csrf())),
				() -> jdbcTemplate.update("update forum_questions set useful_answer_id = ? where id = ?", answerId,
						questionId));

		assertThat(status).isEqualTo(204);
		assertThat(usefulAnswerId()).isNull();
	}

	@Test
	void answeringWaitsForARetirementInProgressAndIsRejected() throws Exception {
		publishAQuestion();

		int status = whileAnotherWriteHoldsTheQuestion(
				() -> mockMvc.perform(post("/api/forum/questions/" + questionId + "/answers")
						.with(signedInAs(ANSWERER_ID)).with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"body\": \"Tarde.\"}")),
				() -> jdbcTemplate.update("update forum_questions set retired_at = now(), retired_by = ? where id = ?",
						TEAM_ID, questionId));

		assertThat(status).isEqualTo(404);
		assertThat(jdbcTemplate.queryForObject("select count(*) from forum_answers where question_id = ?",
				Integer.class, questionId)).isZero();
	}

	@Test
	void retiringAnAnswerThatIsBeingRetiredFindsItAlreadyRetired() throws Exception {
		publishAQuestion();
		Long answerId = publishAnAnswer();

		int status = whileAnotherWriteHolds("forum_answers", answerId,
				() -> mockMvc.perform(post("/api/forum/answers/" + answerId + "/retire").with(signedInAs(ANSWERER_ID))
						.with(csrf())),
				() -> jdbcTemplate.update("update forum_answers set retired_at = now(), retired_by = ? where id = ?",
						TEAM_ID, answerId));

		assertThat(status).isEqualTo(404);
		assertThat(jdbcTemplate.queryForObject("select retired_by from forum_answers where id = ?", Long.class,
				answerId)).isEqualTo(TEAM_ID);
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
