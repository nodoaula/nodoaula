package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pruebas de HU107 (listar y filtrar recursos por curso): el listado expone
 * los campos requeridos, el filtro por curso es una comparación exacta que
 * solo deja ver recursos de ese curso, un filtro sin coincidencias no es un
 * error, y el selector de cursos solo ofrece asignaturas con recursos.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResourceCourseFilterTests {

	private static final Long AUTHOR_ID = 999L;

	@Autowired private MockMvc mockMvc;
	@Autowired private ResourceService resourceService;
	@Autowired private CourseRepository courseRepository;
	@Autowired private ResourceRepository resourceRepository;

	private static CreateResourceRequest request(String course, String urlSuffix) {
		return new CreateResourceRequest(
				"Recurso de la prueba de filtro " + urlSuffix,
				"Descripcion de la prueba de filtro.",
				LocalDate.of(2026, 10, 1),
				600,
				"Canal de la prueba",
				"https://www.youtube.com/watch?v=" + urlSuffix,
				ResourceType.VIDEO,
				course,
				List.of("Tema de la prueba de filtro"));
	}

	@Test
	void listingExposesTitleCourseTypeAndDuration() throws Exception {
		resourceService.createResource(request("Curso del listado", "filtro-listado"), AUTHOR_ID);

		mockMvc.perform(get("/api/resources").param("q", "filtro-listado"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].title").value("Recurso de la prueba de filtro filtro-listado"))
				.andExpect(jsonPath("$[0].course").value("Curso del listado"))
				.andExpect(jsonPath("$[0].resourceType").value("VIDEO"))
				.andExpect(jsonPath("$[0].durationSeconds").value(600));
	}

	@Test
	void filteringByCourseOnlyReturnsResourcesFromThatCourse() throws Exception {
		ResourceDto resourceA = resourceService.createResource(
				request("Curso A de la prueba de filtro", "filtro-curso-a"), AUTHOR_ID);
		resourceService.createResource(request("Curso B de la prueba de filtro", "filtro-curso-b"), AUTHOR_ID);

		Resource savedA = resourceRepository.findById(resourceA.id()).orElseThrow();
		Long courseAId = savedA.getCourse().getId();

		mockMvc.perform(get("/api/resources").param("courseId", courseAId.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.course == 'Curso B de la prueba de filtro')]").isEmpty())
				.andExpect(jsonPath("$[?(@.course == 'Curso A de la prueba de filtro')]").isNotEmpty());
	}

	@Test
	void filteringByACourseWithNoMatchingResourcesReturnsAnEmptyListNotAnError() throws Exception {
		Course emptyCourse = courseRepository.saveAndFlush(new Course("Curso vacio de la prueba de filtro"));

		mockMvc.perform(get("/api/resources").param("courseId", emptyCourse.getId().toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void courseSelectorOnlyOffersCoursesThatHaveAtLeastOneResource() throws Exception {
		Course emptyCourse = courseRepository.saveAndFlush(new Course("Curso sin recursos de la prueba de filtro"));
		resourceService.createResource(
				request("Curso con recursos de la prueba de filtro", "filtro-con-recursos"), AUTHOR_ID);

		List<CourseDto> courses = resourceService.listCoursesWithResources();

		assertTrue(courses.stream()
				.anyMatch(course -> course.name().equals("Curso con recursos de la prueba de filtro")));
		assertTrue(courses.stream().noneMatch(course -> course.id().equals(emptyCourse.getId())));
	}

}
