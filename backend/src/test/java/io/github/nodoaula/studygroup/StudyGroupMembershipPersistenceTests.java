package io.github.nodoaula.studygroup;

import static io.github.nodoaula.studygroup.StudyGroupTestSupport.create;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.join;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.leave;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.newAccount;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.newCourse;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.signedInAs;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.unique;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
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
 * Unirse y salir de un grupo (HU405) queda guardado, también cuando la misma
 * cuenta se une dos veces a la vez. Sin la transacción de la prueba a
 * propósito, como StudyGroupPersistenceTests: con ella, un servicio sin
 * @Transactional pasaría las demás pruebas sin guardar nada, y no habría dos
 * transacciones que se crucen.
 *
 * No depende de lo que haya en la base: crea su propio curso y sus cuentas, y
 * al terminar borra todo lo que creó.
 */
@SpringBootTest
@AutoConfigureMockMvc
class StudyGroupMembershipPersistenceTests {

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;
	@Autowired private PlatformTransactionManager transactionManager;

	private Long courseId;
	private Long creatorId;
	private Long studentId;
	private Long groupId;

	@BeforeEach
	void createAGroup() throws Exception {
		courseId = newCourse(jdbcTemplate);
		creatorId = newAccount(jdbcTemplate);
		studentId = newAccount(jdbcTemplate);
		String response = mockMvc.perform(create(creatorId, courseId, unique("Grupo de persistencia"), null))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		groupId = JsonPath.<Number>read(response, "$.id").longValue();
	}

	@AfterEach
	void deleteWhatWasCreated() {
		jdbcTemplate.update("delete from study_group_members where group_id in "
				+ "(select id from study_groups where course_id = ?)", courseId);
		jdbcTemplate.update("delete from study_groups where course_id = ?", courseId);
		jdbcTemplate.update("delete from forum_answers where question_id in "
				+ "(select id from forum_questions where course_id = ?)", courseId);
		jdbcTemplate.update("delete from forum_questions where course_id = ?", courseId);
		jdbcTemplate.update("delete from courses where id = ?", courseId);
		jdbcTemplate.update("delete from accounts where id in (?, ?)", creatorId, studentId);
	}

	private Integer membershipsOfTheStudent() {
		return jdbcTemplate.queryForObject(
				"select count(*) from study_group_members where group_id = ? and account_id = ?",
				Integer.class, groupId, studentId);
	}

	@Test
	void joiningSavesTheMembershipAndLeavingDeletesIt() throws Exception {
		mockMvc.perform(join(groupId).with(signedInAs(studentId))).andExpect(status().isCreated());
		assertThat(membershipsOfTheStudent()).isEqualTo(1);

		mockMvc.perform(leave(groupId).with(signedInAs(studentId))).andExpect(status().isOk());
		assertThat(membershipsOfTheStudent()).isZero();
	}

	// El grupo no se borra ni se retira cuando se queda sin miembros.
	@Test
	void whenTheLastMemberLeavesTheGroupIsKept() throws Exception {
		mockMvc.perform(leave(groupId).with(signedInAs(creatorId))).andExpect(status().isOk());

		assertThat(jdbcTemplate.queryForObject("select count(*) from study_group_members where group_id = ?",
				Integer.class, groupId)).isZero();
		assertThat(jdbcTemplate.queryForObject(
				"select count(*) from study_groups g join forum_questions q on q.id = g.thread_id"
						+ " where g.id = ? and g.retired_at is null and q.retired_at is null",
				Integer.class, groupId)).isEqualTo(1);
	}

	/**
	 * La misma cuenta se está uniendo en otra transacción que aún no confirma:
	 * la comprobación previa no la ve, y la restricción única hace esperar a
	 * esta petición hasta que la otra confirme. Entonces responde 409 y queda
	 * una sola pertenencia.
	 */
	@Test
	void joiningTwiceAtOnceLeavesASingleMembership() throws Exception {
		int status;
		try (ExecutorService executor = Executors.newSingleThreadExecutor()) {
			Future<ResultActions> response = new TransactionTemplate(transactionManager).execute(transaction -> {
				jdbcTemplate.update("insert into study_group_members (group_id, account_id) values (?, ?)",
						groupId, studentId);
				Integer holder = jdbcTemplate.queryForObject("select pg_backend_pid()", Integer.class);
				Future<ResultActions> pending = executor.submit(
						() -> mockMvc.perform(join(groupId).with(signedInAs(studentId))));
				// Solo cuenta una espera por esta transacción, no cualquiera de la base.
				await().atMost(Duration.ofSeconds(5)).until(() -> jdbcTemplate.queryForObject(
						"select count(*) from pg_locks where not granted and ? = any(pg_blocking_pids(pid))",
						Integer.class, holder) > 0);
				return pending;
			});
			status = response.get(10, TimeUnit.SECONDS).andReturn().getResponse().getStatus();
		}

		assertThat(status).isEqualTo(409);
		assertThat(membershipsOfTheStudent()).isEqualTo(1);
	}

}
