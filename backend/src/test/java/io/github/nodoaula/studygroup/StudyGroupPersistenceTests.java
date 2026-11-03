package io.github.nodoaula.studygroup;

import static io.github.nodoaula.studygroup.StudyGroupTestSupport.SEED_COURSE;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.courseId;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.create;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.signedInAs;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.unique;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.jayway.jsonpath.JsonPath;

/**
 * Crear y retirar un grupo queda guardado, con su miembro y su hilo, también
 * cuando dos grupos con el mismo nombre se crean a la vez. Sin la transacción
 * de la prueba a propósito: con ella, un servicio sin @Transactional pasaría
 * las demás pruebas sin guardar nada, y no habría dos transacciones que se
 * crucen. Por eso borra lo que crea.
 */
@SpringBootTest
@AutoConfigureMockMvc
class StudyGroupPersistenceTests {

	private static final Long CREATOR_ID = 999L;
	private static final Long OTHER_ID = 998L;

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;
	@Autowired private PlatformTransactionManager transactionManager;

	private Long courseId;

	// Único por ejecución: la limpieza borra por nombre y no debe tocar un grupo
	// que ya existiera en la base local.
	private final String name = unique("Grupo de la prueba de persistencia");

	@BeforeEach
	void findSeedCourse() {
		courseId = courseId(jdbcTemplate, SEED_COURSE);
	}

	@AfterEach
	void deleteWhatWasCreated() {
		jdbcTemplate.update("delete from study_group_members where group_id in "
				+ "(select id from study_groups where course_id = ? and name = ?)", courseId, name);
		jdbcTemplate.update("delete from study_groups where course_id = ? and name = ?", courseId, name);
		jdbcTemplate.update("delete from forum_questions where course_id = ? and title = ?", courseId, name);
	}

	private Long createGroup() throws Exception {
		String response = mockMvc.perform(create(CREATOR_ID, courseId, name, "Descripción."))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return JsonPath.<Number>read(response, "$.id").longValue();
	}

	@Test
	void creatingSavesTheGroupItsCreatorAsMemberAndItsThread() throws Exception {
		Long id = createGroup();

		Map<String, Object> group = jdbcTemplate.queryForMap(
				"select name, description, creator_id, thread_id from study_groups where id = ?", id);
		assertThat(group)
				.containsEntry("name", name)
				.containsEntry("description", "Descripción.")
				.containsEntry("creator_id", CREATOR_ID);
		assertThat(jdbcTemplate.queryForList("select account_id from study_group_members where group_id = ?",
				Long.class, id)).containsExactly(CREATOR_ID);
		Map<String, Object> thread = jdbcTemplate.queryForMap(
				"select course_id, title, body, author_id, group_thread from forum_questions where id = ?",
				group.get("thread_id"));
		assertThat(thread)
				.containsEntry("course_id", courseId)
				.containsEntry("title", name)
				.containsEntry("body", "Descripción.")
				.containsEntry("author_id", CREATOR_ID)
				.containsEntry("group_thread", true);
	}

	// El retiro es lógico: las filas siguen ahí, con quién las retiró.
	@Test
	void retiringSavesTheGroupAndItsThreadAsRetired() throws Exception {
		Long id = createGroup();

		mockMvc.perform(post("/api/study-groups/" + id + "/retire").with(signedInAs(CREATOR_ID)).with(csrf()))
				.andExpect(status().isNoContent());

		assertThat(jdbcTemplate.queryForObject("select retired_by from study_groups where id = ? and retired_at is not null",
				Long.class, id)).isEqualTo(CREATOR_ID);
		assertThat(jdbcTemplate.queryForObject("select q.retired_by from forum_questions q "
				+ "join study_groups g on g.thread_id = q.id where g.id = ? and q.retired_at is not null",
				Long.class, id)).isEqualTo(CREATOR_ID);
	}

	/**
	 * Otro grupo con el mismo nombre se está creando y aún no confirma: la
	 * comprobación previa no lo ve, y el índice único hace esperar a esta
	 * creación hasta que el otro confirme. Entonces esta responde 409 y se
	 * deshace entera, sin dejar su hilo en el foro.
	 */
	@Test
	void twoGroupsWithTheSameNameCreatedAtOnceLeaveOneAndNoOrphanThread() throws Exception {
		int status;
		try (ExecutorService executor = Executors.newSingleThreadExecutor()) {
			Future<ResultActions> response = new TransactionTemplate(transactionManager).execute(transaction -> {
				Long threadId = jdbcTemplate.queryForObject("insert into forum_questions "
						+ "(course_id, author_id, title, body, group_thread) values (?, ?, ?, '', true) returning id",
						Long.class, courseId, OTHER_ID, name);
				jdbcTemplate.update("insert into study_groups (course_id, name, normalized_name, creator_id, thread_id)"
						+ " values (?, ?, ?, ?, ?)", courseId, name, name.toLowerCase(), OTHER_ID, threadId);
				Integer holder = jdbcTemplate.queryForObject("select pg_backend_pid()", Integer.class);
				Future<ResultActions> pending = executor.submit(
						() -> mockMvc.perform(create(CREATOR_ID, courseId, "  " + name.toUpperCase() + " ", null)));
				// Solo cuenta una espera por esta transacción, no cualquiera de la base.
				await().atMost(Duration.ofSeconds(5)).until(() -> jdbcTemplate.queryForObject(
						"select count(*) from pg_locks where not granted and ? = any(pg_blocking_pids(pid))",
						Integer.class, holder) > 0);
				return pending;
			});
			status = response.get(10, TimeUnit.SECONDS).andReturn().getResponse().getStatus();
		}

		assertThat(status).isEqualTo(409);
		assertThat(jdbcTemplate.queryForObject("select count(*) from study_groups where course_id = ? and name = ?",
				Integer.class, courseId, name)).isEqualTo(1);
		assertThat(jdbcTemplate.queryForObject(
				"select count(*) from forum_questions where course_id = ? and lower(title) = lower(?)",
				Integer.class, courseId, name)).isEqualTo(1);
	}

}
