package io.github.nodoaula.studygroup;

import static io.github.nodoaula.studygroup.StudyGroupTestSupport.SEED_COURSE;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.courseId;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.create;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.signedInAs;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.teamAccount;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

/**
 * Pruebas de HU404 sobre el retiro: quien creó el grupo y las cuentas del
 * equipo lo retiran; nadie más (403). El retiro es lógico y su hilo deja de
 * verse con él.
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
	private Long groupId;
	private Long threadId;

	@BeforeEach
	void createAGroup() throws Exception {
		courseId = courseId(jdbcTemplate, SEED_COURSE);
		String response = mockMvc.perform(create(CREATOR_ID, courseId, "Para retirar", "Descripción."))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		groupId = JsonPath.<Number>read(response, "$.id").longValue();
		threadId = JsonPath.<Number>read(response, "$.threadId").longValue();
	}

	private MockHttpServletRequestBuilder retire() {
		return post("/api/study-groups/" + groupId + "/retire").with(csrf());
	}

	@Test
	void itsCreatorRetiresItAndItStopsBeingSeenWithItsThread() throws Exception {
		mockMvc.perform(retire().with(signedInAs(CREATOR_ID)))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()))
				.andExpect(jsonPath("$", hasSize(0)));
		mockMvc.perform(get("/api/forum/questions").param("courseId", courseId.toString()))
				.andExpect(jsonPath("$", hasSize(0)));
		mockMvc.perform(get("/api/forum/questions/" + threadId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.retired").value(true));
		mockMvc.perform(get("/api/forum/questions/" + threadId + "/answers"))
				.andExpect(status().isNotFound());
	}

	@Test
	void aRetiredGroupFreesItsNameInTheCourse() throws Exception {
		mockMvc.perform(retire().with(signedInAs(CREATOR_ID))).andExpect(status().isNoContent());

		mockMvc.perform(create(OTHER_ID, courseId, "Para retirar", null))
				.andExpect(status().isCreated());
	}

	@Test
	void aTeamAccountCanRetireAnyGroup() throws Exception {
		Long team = teamAccount(jdbcTemplate, "equipo.retiro@ejemplo.com");

		mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()).with(signedInAs(team)))
				.andExpect(jsonPath("$[0].canRetire").value(true));
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

		mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()))
				.andExpect(jsonPath("$", hasSize(1)));
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
