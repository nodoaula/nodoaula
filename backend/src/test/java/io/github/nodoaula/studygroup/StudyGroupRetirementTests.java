package io.github.nodoaula.studygroup;

import static io.github.nodoaula.studygroup.StudyGroupTestSupport.SEED_COURSE;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.courseId;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.create;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.signedInAs;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.teamAccount;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.unique;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.withId;
import static org.hamcrest.Matchers.contains;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

/**
 * Pruebas de HU404 sobre el retiro: quien creó el grupo y las cuentas del
 * equipo lo retiran; nadie más (403). El retiro es lógico y su hilo deja de
 * verse con él.
 *
 * Miran solo el grupo que crean: el curso puede tener otros grupos y otras
 * preguntas en la base local.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class StudyGroupRetirementTests {

	private static final Long CREATOR_ID = 999L;
	private static final Long OTHER_ID = 998L;

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long courseId;
	private String name;
	private Long groupId;
	private Long threadId;

	@BeforeEach
	void createAGroup() throws Exception {
		courseId = courseId(jdbcTemplate, SEED_COURSE);
		name = unique("Para retirar");
		String response = mockMvc.perform(create(CREATOR_ID, courseId, name, "Descripción."))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		groupId = JsonPath.<Number>read(response, "$.id").longValue();
		threadId = JsonPath.<Number>read(response, "$.threadId").longValue();
	}

	private MockHttpServletRequestBuilder retire() {
		return post("/api/study-groups/" + groupId + "/retire").with(csrf());
	}

	private ResultActions groupsOfTheCourse() throws Exception {
		return mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()))
				.andExpect(status().isOk());
	}

	private ResultActions forumOfTheCourse() throws Exception {
		return mockMvc.perform(get("/api/forum/questions").param("courseId", courseId.toString()))
				.andExpect(status().isOk());
	}

	@Test
	void itsCreatorRetiresItAndItStopsBeingSeenWithItsThread() throws Exception {
		mockMvc.perform(retire().with(signedInAs(CREATOR_ID)))
				.andExpect(status().isNoContent());

		groupsOfTheCourse().andExpect(jsonPath(withId(groupId)).isEmpty());
		forumOfTheCourse().andExpect(jsonPath(withId(threadId)).isEmpty());
		mockMvc.perform(get("/api/forum/questions/" + threadId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.retired").value(true));
		mockMvc.perform(get("/api/forum/questions/" + threadId + "/answers"))
				.andExpect(status().isNotFound());
	}

	@Test
	void aRetiredGroupFreesItsNameInTheCourse() throws Exception {
		mockMvc.perform(retire().with(signedInAs(CREATOR_ID))).andExpect(status().isNoContent());

		mockMvc.perform(create(OTHER_ID, courseId, name, null))
				.andExpect(status().isCreated());
	}

	@Test
	void aTeamAccountCanRetireAnyGroup() throws Exception {
		Long team = teamAccount(jdbcTemplate, unique("equipo.retiro").replace(' ', '.') + "@ejemplo.com");

		mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()).with(signedInAs(team)))
				.andExpect(jsonPath(withId(groupId) + ".canRetire").value(contains(true)));
		mockMvc.perform(retire().with(signedInAs(team)))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/forum/questions/" + threadId))
				.andExpect(jsonPath("$.retired").value(true));
	}

	@Test
	void anotherAccountCannotRetireItAndTheApiAnswers403() throws Exception {
		mockMvc.perform(retire().with(signedInAs(OTHER_ID)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("STUDY_GROUP_CHANGE_FORBIDDEN"));

		groupsOfTheCourse().andExpect(jsonPath(withId(groupId)).isNotEmpty());
		mockMvc.perform(get("/api/forum/questions/" + threadId))
				.andExpect(jsonPath("$.retired").value(false));
	}

	@Test
	void retiringWithoutASessionIsA401() throws Exception {
		mockMvc.perform(retire())
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	@Test
	void aRetiredOrMissingGroupIsA404() throws Exception {
		mockMvc.perform(retire().with(signedInAs(CREATOR_ID))).andExpect(status().isNoContent());

		mockMvc.perform(retire().with(signedInAs(CREATOR_ID)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("STUDY_GROUP_NOT_FOUND"));
		mockMvc.perform(post("/api/study-groups/999999999/retire").with(signedInAs(CREATOR_ID)).with(csrf()))
				.andExpect(status().isNotFound());
	}

}
