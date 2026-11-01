package io.github.nodoaula.studygroup;

import static io.github.nodoaula.studygroup.StudyGroupTestSupport.OTHER_COURSE;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.SEED_COURSE;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.courseId;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.create;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.signedInAs;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.unique;
import static io.github.nodoaula.studygroup.StudyGroupTestSupport.withId;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

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
 * Pruebas de HU404: crear un grupo exige sesión, va en un curso con nombre y
 * descripción acotados, no repite nombre en el curso sin distinguir
 * mayúsculas ni tildes, deja a quien lo crea como miembro y aparece en la
 * lista de grupos del curso, que se lee sin sesión.
 *
 * Miran solo los grupos que crean: la base local puede tener otros en los
 * cursos de la semilla.
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

	private ResultActions listOf(Long course) throws Exception {
		return mockMvc.perform(get("/api/study-groups").param("courseId", course.toString()))
				.andExpect(status().isOk());
	}

	private ResultActions listOf(Long course, Long viewerId) throws Exception {
		return mockMvc.perform(get("/api/study-groups").param("courseId", course.toString())
				.with(signedInAs(viewerId)))
				.andExpect(status().isOk());
	}

	@Test
	void createsAGroupOfACourseAndItAppearsInTheListOfThatCourse() throws Exception {
		String name = unique("Parcial de patrones");
		String response = mockMvc.perform(create(CREATOR_ID, courseId, "  " + name + "  ", "  Repasamos los GoF.  "))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.courseId").value(courseId))
				.andExpect(jsonPath("$.name").value(name))
				.andExpect(jsonPath("$.description").value("Repasamos los GoF."))
				.andExpect(jsonPath("$.createdAt").isNotEmpty())
				.andExpect(jsonPath("$.threadId").isNumber())
				.andExpect(jsonPath("$.member").value(true))
				.andExpect(jsonPath("$.canRetire").value(true))
				.andExpect(jsonPath("$.creatorId").doesNotExist())
				.andExpect(jsonPath("$.email").doesNotExist())
				.andReturn().getResponse().getContentAsString();
		Long id = JsonPath.<Number>read(response, "$.id").longValue();

		listOf(courseId).andExpect(jsonPath(withId(id) + ".name").value(contains(name)));
		listOf(otherCourseId).andExpect(jsonPath(withId(id)).isEmpty());
	}

	@Test
	void theListGoesFromTheNewestToTheOldest() throws Exception {
		Long first = createGroup(courseId, unique("Primero"));
		Long second = createGroup(courseId, unique("Segundo"));

		String response = listOf(courseId).andReturn().getResponse().getContentAsString();
		List<Long> ids = JsonPath.<List<Number>>read(response, "$[*].id").stream().map(Number::longValue).toList();
		assertThat(ids).containsSubsequence(second, first);
	}

	@Test
	void creatingRequiresASessionButTheListIsReadWithout() throws Exception {
		Long id = createGroup(courseId, unique("Visible sin sesión"));
		String rejected = unique("Sin sesión");

		mockMvc.perform(post("/api/study-groups").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"courseId\": %s, \"name\": \"%s\"}".formatted(courseId, rejected)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

		listOf(courseId)
				.andExpect(jsonPath(withId(id) + ".member").value(contains(false)))
				.andExpect(jsonPath(withId(id) + ".canRetire").value(contains(false)))
				.andExpect(jsonPath("$[?(@.name == '" + rejected + "')]").isEmpty());
	}

	@Test
	void whoeverCreatesItIsAMemberAndNobodyElseIs() throws Exception {
		Long id = createGroup(courseId, unique("Con su creador"));

		assertThat(jdbcTemplate.queryForList("select account_id from study_group_members where group_id = ?",
				Long.class, id)).containsExactly(CREATOR_ID);
		listOf(courseId, CREATOR_ID).andExpect(jsonPath(withId(id) + ".member").value(contains(true)));
		listOf(courseId, OTHER_ID)
				.andExpect(jsonPath(withId(id) + ".member").value(contains(false)))
				.andExpect(jsonPath(withId(id) + ".canRetire").value(contains(false)));
	}

	@Test
	void theDescriptionIsOptional() throws Exception {
		mockMvc.perform(create(CREATOR_ID, courseId, unique("Sin descripción"), null))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.description").doesNotExist());
		mockMvc.perform(create(CREATOR_ID, courseId, unique("Descripción en blanco"), "   "))
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
		String name = unique("Nombre largo");
		mockMvc.perform(create(CREATOR_ID, courseId, name + "n".repeat(200 - name.length()), "d".repeat(2000)))
				.andExpect(status().isCreated());

		mockMvc.perform(create(CREATOR_ID, courseId, "n".repeat(201), null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("name"));
		mockMvc.perform(create(CREATOR_ID, courseId, unique("Descripción larga"), "d".repeat(2001)))
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
		mockMvc.perform(create(CREATOR_ID, 999999999L, unique("Curso inexistente"), null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[0].field").value("courseId"));
	}

	@Test
	void aNameThatDiffersOnlyInCaseOrAccentsInTheSameCourseIsA409() throws Exception {
		String suffix = unique("").strip();
		Long id = createGroup(courseId, "Patrones de Diseño " + suffix);
		int groupsBefore = countVisibleGroupsOf(courseId);
		int threadsBefore = countGroupThreadsOf(courseId);

		mockMvc.perform(create(OTHER_ID, courseId, "  PATRONES  de  diseno " + suffix.toUpperCase() + " ", null))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("STUDY_GROUP_NAME_TAKEN"));

		listOf(courseId).andExpect(jsonPath(withId(id)).isNotEmpty());
		assertThat(countVisibleGroupsOf(courseId)).isEqualTo(groupsBefore);
		// El 409 no deja un hilo huérfano en el foro.
		assertThat(countGroupThreadsOf(courseId)).isEqualTo(threadsBefore);
	}

	private int countVisibleGroupsOf(Long course) {
		return jdbcTemplate.queryForObject(
				"select count(*) from study_groups where course_id = ? and retired_at is null", Integer.class, course);
	}

	private int countGroupThreadsOf(Long course) {
		return jdbcTemplate.queryForObject(
				"select count(*) from forum_questions where course_id = ? and group_thread", Integer.class, course);
	}

	@Test
	void theSameNameInAnotherCourseIsNotAConflict() throws Exception {
		String name = unique("Repaso final");
		createGroup(courseId, name);

		mockMvc.perform(create(CREATOR_ID, otherCourseId, name, null))
				.andExpect(status().isCreated());
	}

}
