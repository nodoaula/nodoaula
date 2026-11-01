package io.github.nodoaula.studygroup;

import static io.github.nodoaula.studygroup.StudyGroupTestSupport.SEED_COURSE;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.courseId;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.create;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.signedInAs;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.teamAccount;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.unique;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.withId;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

/**
 * Pruebas de HU404 sobre el hilo de un grupo: se crea con el grupo en el foro
 * de su curso, con su nombre y su descripción y marcado como de grupo.
 * Cualquiera lo lee, solo sus miembros responden en él (a los demás, 403) y
 * no se retira desde el foro.
 *
 * Miran solo los hilos que crean: el foro del curso puede tener otras
 * preguntas en la base local.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GroupThreadTests {

	private static final Long CREATOR_ID = 999L;
	private static final Long OTHER_ID = 998L;

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long courseId;

	@BeforeEach
	void findSeedCourse() {
		courseId = courseId(jdbcTemplate, SEED_COURSE);
	}

	private Long threadOfNewGroup(String name, String description) throws Exception {
		String response = mockMvc.perform(create(CREATOR_ID, courseId, name, description))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return JsonPath.<Number>read(response, "$.threadId").longValue();
	}

	private static MockHttpServletRequestBuilder answer(Long threadId) {
		return post("/api/forum/questions/" + threadId + "/answers").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"body\": \"Nos vemos el martes.\"}");
	}

	private ResultActions forumAs(Long viewerId) throws Exception {
		return mockMvc.perform(get("/api/forum/questions").param("courseId", courseId.toString())
				.with(signedInAs(viewerId)))
				.andExpect(status().isOk());
	}

	@Test
	void creatingTheGroupCreatesItsThreadInTheCourseForumMarkedAsAGroup() throws Exception {
		String name = unique("Parcial de patrones");
		Long threadId = threadOfNewGroup(name, "Repasamos los GoF.");

		mockMvc.perform(get("/api/forum/questions").param("courseId", courseId.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath(withId(threadId)).value(hasSize(1)))
				.andExpect(jsonPath(withId(threadId) + ".title").value(contains(name)))
				.andExpect(jsonPath(withId(threadId) + ".body").value(contains("Repasamos los GoF.")))
				.andExpect(jsonPath(withId(threadId) + ".group").value(contains(true)));
	}

	@Test
	void theThreadOfAGroupWithoutDescriptionHasAnEmptyBody() throws Exception {
		String name = unique("Sin descripción");
		Long threadId = threadOfNewGroup(name, null);

		mockMvc.perform(get("/api/forum/questions/" + threadId))
				.andExpect(jsonPath("$.title").value(name))
				.andExpect(jsonPath("$.body").value(""));
	}

	@Test
	void anyoneReadsTheThreadEvenWithoutASession() throws Exception {
		Long threadId = threadOfNewGroup(unique("Abierto a leer"), null);
		mockMvc.perform(answer(threadId).with(signedInAs(CREATOR_ID))).andExpect(status().isCreated());

		mockMvc.perform(get("/api/forum/questions/" + threadId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.group").value(true))
				.andExpect(jsonPath("$.canAnswer").value(false));
		mockMvc.perform(get("/api/forum/questions/" + threadId + "/answers"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)));
		mockMvc.perform(get("/api/forum/questions/" + threadId + "/answers").with(signedInAs(OTHER_ID)))
				.andExpect(status().isOk());
	}

	@Test
	void onlyItsMembersAnswerAndTheRestGetA403() throws Exception {
		Long threadId = threadOfNewGroup(unique("Solo miembros"), null);

		mockMvc.perform(answer(threadId).with(signedInAs(CREATOR_ID)))
				.andExpect(status().isCreated());
		mockMvc.perform(answer(threadId).with(signedInAs(OTHER_ID)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("GROUP_MEMBERS_ONLY"));
		mockMvc.perform(get("/api/forum/questions/" + threadId + "/answers"))
				.andExpect(jsonPath("$", hasSize(1)));
	}

	@Test
	void aTeamAccountThatIsNotAMemberDoesNotAnswerEither() throws Exception {
		Long threadId = threadOfNewGroup(unique("Ni el equipo"), null);
		Long team = teamAccount(jdbcTemplate, unique("equipo.grupos").replace(' ', '.') + "@ejemplo.com");

		mockMvc.perform(answer(threadId).with(signedInAs(team)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("GROUP_MEMBERS_ONLY"));
	}

	@Test
	void theQuestionSaysWhoCanAnswer() throws Exception {
		Long threadId = threadOfNewGroup(unique("Quién responde"), null);

		mockMvc.perform(get("/api/forum/questions/" + threadId).with(signedInAs(CREATOR_ID)))
				.andExpect(jsonPath("$.canAnswer").value(true));
		mockMvc.perform(get("/api/forum/questions/" + threadId).with(signedInAs(OTHER_ID)))
				.andExpect(jsonPath("$.canAnswer").value(false));
		forumAs(CREATOR_ID).andExpect(jsonPath(withId(threadId) + ".canAnswer").value(contains(true)));
		forumAs(OTHER_ID).andExpect(jsonPath(withId(threadId) + ".canAnswer").value(contains(false)));
	}

	@Test
	void anOrdinaryQuestionIsAnsweredByAnyAccountAndIsNotAGroup() throws Exception {
		String response = mockMvc.perform(post("/api/forum/questions").with(signedInAs(CREATOR_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"courseId\": %s, \"title\": \"Duda\", \"body\": \"Texto.\"}".formatted(courseId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.group").value(false))
				.andExpect(jsonPath("$.canAnswer").value(true))
				.andReturn().getResponse().getContentAsString();
		Long questionId = JsonPath.<Number>read(response, "$.id").longValue();

		mockMvc.perform(get("/api/forum/questions/" + questionId).with(signedInAs(OTHER_ID)))
				.andExpect(jsonPath("$.canAnswer").value(true));
		mockMvc.perform(get("/api/forum/questions/" + questionId))
				.andExpect(jsonPath("$.canAnswer").value(false));
		mockMvc.perform(answer(questionId).with(signedInAs(OTHER_ID)))
				.andExpect(status().isCreated());
	}

	@Test
	void theThreadIsNotRetiredFromTheForumNotEvenByItsCreatorOrTheTeam() throws Exception {
		Long threadId = threadOfNewGroup(unique("Se retira con el grupo"), null);
		Long team = teamAccount(jdbcTemplate, unique("equipo.hilo").replace(' ', '.') + "@ejemplo.com");

		mockMvc.perform(get("/api/forum/questions/" + threadId).with(signedInAs(CREATOR_ID)))
				.andExpect(jsonPath("$.canRetire").value(false));
		mockMvc.perform(post("/api/forum/questions/" + threadId + "/retire").with(signedInAs(CREATOR_ID)).with(csrf()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("GROUP_THREAD_CHANGE_FORBIDDEN"));
		mockMvc.perform(post("/api/forum/questions/" + threadId + "/retire").with(signedInAs(team)).with(csrf()))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/forum/questions/" + threadId))
				.andExpect(jsonPath("$.retired").value(false));
	}

}
