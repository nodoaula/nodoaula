package io.github.nodoaula.studygroup;

import static io.github.nodoaula.studygroup.StudyGroupTestSupport.create;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.join;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.leave;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.newAccount;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.newCourse;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.signedInAs;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.teamAccount;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.unique;
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
 * Pruebas de HU405: unirse a un grupo exige sesión y nadie se une dos veces;
 * cualquiera ve cuántos miembros tiene, pero quiénes son solo lo ven sus
 * miembros, sin correo; quien sale deja de responder en su hilo, y si sale el
 * último miembro el grupo sigue abierto.
 *
 * No dependen de lo que haya en la base: cada prueba crea su curso, sus
 * cuentas y su grupo, y la transacción de la prueba los deshace al terminar.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class StudyGroupMembershipTests {

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long courseId;
	private Long creatorId;
	private Long studentId;
	private Long groupId;
	private Long threadId;

	@BeforeEach
	void createAGroup() throws Exception {
		courseId = newCourse(jdbcTemplate);
		creatorId = newAccount(jdbcTemplate);
		studentId = newAccount(jdbcTemplate);
		String response = mockMvc.perform(create(creatorId, courseId, unique("Repaso del parcial"), "Los martes."))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.memberCount").value(1))
				.andReturn().getResponse().getContentAsString();
		groupId = JsonPath.<Number>read(response, "$.id").longValue();
		threadId = JsonPath.<Number>read(response, "$.threadId").longValue();
	}

	private ResultActions groupsAs(Long viewerId) throws Exception {
		MockHttpServletRequestBuilder request = get("/api/study-groups").param("courseId", courseId.toString());
		return mockMvc.perform(viewerId == null ? request : request.with(signedInAs(viewerId)))
				.andExpect(status().isOk())
				// El curso es de la prueba: solo tiene su grupo.
				.andExpect(jsonPath("$", hasSize(1)));
	}

	private MockHttpServletRequestBuilder members() {
		return get("/api/study-groups/" + groupId + "/members");
	}

	private MockHttpServletRequestBuilder answerInTheThread() {
		return post("/api/forum/questions/" + threadId + "/answers").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"body\": \"Nos vemos el martes.\"}");
	}

	// --- Unirse requiere sesión, y nadie se une dos veces al mismo grupo ---

	@Test
	void aStudentJoinsAndBecomesAMember() throws Exception {
		mockMvc.perform(join(groupId).with(signedInAs(studentId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(groupId))
				.andExpect(jsonPath("$.member").value(true))
				.andExpect(jsonPath("$.memberCount").value(2))
				.andExpect(jsonPath("$.canRetire").value(false));

		groupsAs(studentId)
				.andExpect(jsonPath("$[0].member").value(true))
				.andExpect(jsonPath("$[0].memberCount").value(2));
	}

	@Test
	void joiningWithoutASessionIsA401() throws Exception {
		mockMvc.perform(join(groupId))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

		groupsAs(null).andExpect(jsonPath("$[0].memberCount").value(1));
	}

	@Test
	void nobodyJoinsTheSameGroupTwice() throws Exception {
		mockMvc.perform(join(groupId).with(signedInAs(studentId))).andExpect(status().isCreated());

		mockMvc.perform(join(groupId).with(signedInAs(studentId)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ALREADY_A_MEMBER"));
		groupsAs(null).andExpect(jsonPath("$[0].memberCount").value(2));
	}

	@Test
	void whoeverCreatedItIsAlreadyAMemberAndDoesNotJoinAgain() throws Exception {
		mockMvc.perform(join(groupId).with(signedInAs(creatorId)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ALREADY_A_MEMBER"));
	}

	@Test
	void joiningARetiredOrMissingGroupIsA404() throws Exception {
		mockMvc.perform(post("/api/study-groups/" + groupId + "/retire").with(signedInAs(creatorId)).with(csrf()))
				.andExpect(status().isNoContent());

		mockMvc.perform(join(groupId).with(signedInAs(studentId)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("STUDY_GROUP_NOT_FOUND"));
		mockMvc.perform(join(999_999_999L).with(signedInAs(studentId)))
				.andExpect(status().isNotFound());
	}

	// --- Cualquiera ve cuántos miembros tiene; la lista, solo sus miembros ---

	@Test
	void anyoneSeesHowManyMembersItHasEvenWithoutASession() throws Exception {
		mockMvc.perform(join(groupId).with(signedInAs(studentId))).andExpect(status().isCreated());

		groupsAs(null)
				.andExpect(jsonPath("$[0].memberCount").value(2))
				.andExpect(jsonPath("$[0].member").value(false));
		groupsAs(newAccount(jdbcTemplate))
				.andExpect(jsonPath("$[0].memberCount").value(2))
				.andExpect(jsonPath("$[0].member").value(false));
	}

	@Test
	void aMemberSeesTheMembersWithoutTheirEmailOrAccount() throws Exception {
		mockMvc.perform(join(groupId).with(signedInAs(studentId))).andExpect(status().isCreated());

		mockMvc.perform(members().with(signedInAs(studentId)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(2)))
				// Del primero que se unió al último: quien lo creó va primero.
				.andExpect(jsonPath("$[0].creator").value(true))
				.andExpect(jsonPath("$[0].you").value(false))
				.andExpect(jsonPath("$[1].creator").value(false))
				.andExpect(jsonPath("$[1].you").value(true))
				.andExpect(jsonPath("$[1].joinedAt").isNotEmpty())
				.andExpect(jsonPath("$[*].email").isEmpty())
				.andExpect(jsonPath("$[*].accountId").isEmpty())
				.andExpect(jsonPath("$[*].id").isEmpty());
	}

	@Test
	void theMembersAreNotShownToWhoeverIsNotAMember() throws Exception {
		Long team = teamAccount(jdbcTemplate, unique("equipo.miembros").replace(' ', '.') + "@ejemplo.com");

		mockMvc.perform(members())
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
		mockMvc.perform(members().with(signedInAs(studentId)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("STUDY_GROUP_MEMBERS_ONLY"));
		// Tampoco una cuenta del equipo: moderar no es pertenecer.
		mockMvc.perform(members().with(signedInAs(team)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("STUDY_GROUP_MEMBERS_ONLY"));
	}

	@Test
	void theMembersOfARetiredGroupAreA404() throws Exception {
		mockMvc.perform(post("/api/study-groups/" + groupId + "/retire").with(signedInAs(creatorId)).with(csrf()))
				.andExpect(status().isNoContent());

		mockMvc.perform(members().with(signedInAs(creatorId)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("STUDY_GROUP_NOT_FOUND"));
	}

	// --- Se puede salir, y quien sale deja de responder en su hilo ---

	@Test
	void whoeverLeavesStopsBeingAMemberAndStopsAnsweringInTheThread() throws Exception {
		mockMvc.perform(join(groupId).with(signedInAs(studentId))).andExpect(status().isCreated());
		mockMvc.perform(answerInTheThread().with(signedInAs(studentId))).andExpect(status().isCreated());

		mockMvc.perform(leave(groupId).with(signedInAs(studentId)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.member").value(false))
				.andExpect(jsonPath("$.memberCount").value(1));

		mockMvc.perform(answerInTheThread().with(signedInAs(studentId)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("GROUP_MEMBERS_ONLY"));
		mockMvc.perform(get("/api/forum/questions/" + threadId).with(signedInAs(studentId)))
				.andExpect(jsonPath("$.canAnswer").value(false));
		mockMvc.perform(members().with(signedInAs(studentId)))
				.andExpect(status().isForbidden());
		// Lo que respondió mientras era miembro sigue en el hilo.
		mockMvc.perform(get("/api/forum/questions/" + threadId + "/answers"))
				.andExpect(jsonPath("$", hasSize(1)));
	}

	@Test
	void whoeverLeftCanJoinAgain() throws Exception {
		mockMvc.perform(join(groupId).with(signedInAs(studentId))).andExpect(status().isCreated());
		mockMvc.perform(leave(groupId).with(signedInAs(studentId))).andExpect(status().isOk());

		mockMvc.perform(join(groupId).with(signedInAs(studentId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.memberCount").value(2));
		mockMvc.perform(answerInTheThread().with(signedInAs(studentId)))
				.andExpect(status().isCreated());
	}

	@Test
	void leavingAGroupYouAreNotInIsA409() throws Exception {
		mockMvc.perform(leave(groupId).with(signedInAs(studentId)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("NOT_A_MEMBER"));
	}

	@Test
	void leavingWithoutASessionIsA401() throws Exception {
		mockMvc.perform(leave(groupId))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	// --- Si sale el último miembro, el grupo sigue y cualquiera puede unirse ---

	@Test
	void whenTheLastMemberLeavesTheGroupAndItsThreadRemainAndAnyoneCanJoin() throws Exception {
		mockMvc.perform(answerInTheThread().with(signedInAs(creatorId))).andExpect(status().isCreated());

		mockMvc.perform(leave(groupId).with(signedInAs(creatorId)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.memberCount").value(0));

		groupsAs(null)
				.andExpect(jsonPath("$[0].id").value(groupId))
				.andExpect(jsonPath("$[0].memberCount").value(0));
		mockMvc.perform(get("/api/forum/questions/" + threadId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.retired").value(false));
		mockMvc.perform(get("/api/forum/questions/" + threadId + "/answers"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)));

		mockMvc.perform(join(groupId).with(signedInAs(studentId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.memberCount").value(1));
		mockMvc.perform(answerInTheThread().with(signedInAs(studentId)))
				.andExpect(status().isCreated());
	}

	// Salir no cambia quién lo creó: lo sigue pudiendo retirar (HU404).
	@Test
	void whoeverCreatedItCanStillRetireItAfterLeaving() throws Exception {
		mockMvc.perform(leave(groupId).with(signedInAs(creatorId)))
				.andExpect(jsonPath("$.canRetire").value(true));

		groupsAs(creatorId)
				.andExpect(jsonPath("$[0].member").value(false))
				.andExpect(jsonPath("$[0].canRetire").value(true));
	}

}
