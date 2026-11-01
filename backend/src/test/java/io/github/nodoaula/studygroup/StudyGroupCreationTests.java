package io.github.nodoaula.studygroup;

import static io.github.nodoaula.studygroup.StudyGroupTestSupport.OTHER_COURSE;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.SEED_COURSE;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.courseId;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.create;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.signedInAs;
import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

/**
 * Pruebas de HU404: crear un grupo exige sesión, va en un curso con nombre y
 * descripción acotados, no repite nombre en el curso sin distinguir
 * mayúsculas ni tildes, deja a quien lo crea como miembro y aparece en la
 * lista de grupos del curso, que se lee sin sesión.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class StudyGroupCreationTests {

	private static final Long CREATOR_ID = 999L;
	private static final Long OTHER_ID = 998L;

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long courseId;
	private Long otherCourseId;

	@BeforeEach
	void findSeedCourses() {
		courseId = courseId(jdbcTemplate, SEED_COURSE);
		otherCourseId = courseId(jdbcTemplate, OTHER_COURSE);
	}

	private Long createGroup(Long course, String name) throws Exception {
		String response = mockMvc.perform(create(CREATOR_ID, course, name, "Descripción."))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return JsonPath.<Number>read(response, "$.id").longValue();
	}

	@Test
	void createsAGroupOfACourseAndItAppearsInTheListOfThatCourse() throws Exception {
		mockMvc.perform(create(CREATOR_ID, courseId, "  Parcial de patrones  ", "  Repasamos los GoF.  "))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.courseId").value(courseId))
				.andExpect(jsonPath("$.name").value("Parcial de patrones"))
				.andExpect(jsonPath("$.description").value("Repasamos los GoF."))
				.andExpect(jsonPath("$.createdAt").isNotEmpty())
				.andExpect(jsonPath("$.threadId").isNumber())
				.andExpect(jsonPath("$.member").value(true))
				.andExpect(jsonPath("$.canRetire").value(true))
				.andExpect(jsonPath("$.creatorId").doesNotExist())
				.andExpect(jsonPath("$.email").doesNotExist());

		mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].name").value("Parcial de patrones"));
		mockMvc.perform(get("/api/study-groups").param("courseId", otherCourseId.toString()))
				.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void theListGoesFromTheNewestToTheOldest() throws Exception {
		createGroup(courseId, "Primero");
		createGroup(courseId, "Segundo");

		mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()))
				.andExpect(jsonPath("$[0].name").value("Segundo"))
				.andExpect(jsonPath("$[1].name").value("Primero"));
	}

	@Test
	void creatingRequiresASessionButTheListIsReadWithout() throws Exception {
		createGroup(courseId, "Visible sin sesión");

		mockMvc.perform(post("/api/study-groups").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"courseId\": %s, \"name\": \"Sin sesión\"}".formatted(courseId)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

		mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].member").value(false))
				.andExpect(jsonPath("$[0].canRetire").value(false));
	}

	@Test
	void whoeverCreatesItIsAMemberAndNobodyElseIs() throws Exception {
		Long id = createGroup(courseId, "Con su creador");

		assertThat(jdbcTemplate.queryForList("select account_id from study_group_members where group_id = ?",
				Long.class, id)).containsExactly(CREATOR_ID);
		mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()).with(signedInAs(CREATOR_ID)))
				.andExpect(jsonPath("$[0].member").value(true));
		mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()).with(signedInAs(OTHER_ID)))
				.andExpect(jsonPath("$[0].member").value(false))
				.andExpect(jsonPath("$[0].canRetire").value(false));
	}

	@Test
	void theDescriptionIsOptional() throws Exception {
		mockMvc.perform(create(CREATOR_ID, courseId, "Sin descripción", null))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.description").doesNotExist());
		mockMvc.perform(create(CREATOR_ID, courseId, "Descripción en blanco", "   "))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.description").doesNotExist());
	}

	@Test
	void theNameIsRequired() throws Exception {
		mockMvc.perform(create(CREATOR_ID, courseId, "   ", "Texto."))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[0].field").value("name"));
		// U+2003 es un espacio Unicode: @NotBlank también lo descarta.
		mockMvc.perform(create(CREATOR_ID, courseId, "\\u2003", null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("name"));
	}

	@Test
	void theNameHasUpTo200CharactersAndTheDescriptionUpTo2000() throws Exception {
		mockMvc.perform(create(CREATOR_ID, courseId, "n".repeat(200), "d".repeat(2000)))
				.andExpect(status().isCreated());

		mockMvc.perform(create(CREATOR_ID, courseId, "n".repeat(201), null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("name"));
		mockMvc.perform(create(CREATOR_ID, courseId, "Descripción larga", "d".repeat(2001)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("description"));
	}

	@Test
	void theCourseIsRequiredAndMustExist() throws Exception {
		mockMvc.perform(post("/api/study-groups").with(signedInAs(CREATOR_ID)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\": \"Sin curso\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("courseId"));
		mockMvc.perform(create(CREATOR_ID, 999999999L, "Curso inexistente", null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[0].field").value("courseId"));
	}

	@Test
	void aNameThatDiffersOnlyInCaseOrAccentsInTheSameCourseIsA409() throws Exception {
		createGroup(courseId, "Patrones de Diseño");

		mockMvc.perform(create(OTHER_ID, courseId, "  PATRONES  de  diseno ", null))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("STUDY_GROUP_NAME_TAKEN"));
		mockMvc.perform(get("/api/study-groups").param("courseId", courseId.toString()))
				.andExpect(jsonPath("$", hasSize(1)));
		// El 409 no deja un hilo huérfano en el foro.
		assertThat(jdbcTemplate.queryForObject(
				"select count(*) from forum_questions where course_id = ? and group_thread", Integer.class, courseId))
				.isEqualTo(1);
	}

	@Test
	void theSameNameInAnotherCourseIsNotAConflict() throws Exception {
		createGroup(courseId, "Repaso final");

		mockMvc.perform(create(CREATOR_ID, otherCourseId, "Repaso final", null))
				.andExpect(status().isCreated());
	}

}
