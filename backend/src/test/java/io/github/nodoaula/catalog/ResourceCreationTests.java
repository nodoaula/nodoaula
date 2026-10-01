package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
 * Cubre el registro manual de un recurso (historia HU105): el curso y cada
 * tema se reutilizan si ya existen en el vocabulario controlado o se crean si
 * no, el recurso queda asociado a su autor, y aparece de inmediato en el
 * listado público.
 *
 * Igual que ResourceListingTests, corre contra la base local real (no
 * simulada) y @Transactional deshace al terminar cada prueba lo que haya
 * escrito.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResourceCreationTests {

	private static final Long AUTHOR_ID = 999L;

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ResourceService resourceService;

	@Autowired
	private CourseRepository courseRepository;

	@Autowired
	private TopicRepository topicRepository;

	@Autowired
	private ResourceRepository resourceRepository;

	private static CreateResourceRequest request(String course, List<String> topics, String urlSuffix) {
		return new CreateResourceRequest(
				"Recurso de la prueba de registro " + urlSuffix,
				"Descripcion de la prueba de registro.",
				LocalDate.of(2026, 10, 1),
				600,
				"Canal de la prueba",
				"https://www.youtube.com/watch?v=" + urlSuffix,
				ResourceType.VIDEO,
				course,
				topics);
	}

	@Test
	void createsTheCourseAndTopicsWhenTheyDoNotExistAndAssociatesTheAuthor() throws Exception {
		String courseName = "Curso nuevo de la prueba de registro";

		ResourceDto dto = resourceService.createResource(
				request(courseName, List.of("Tema nuevo B", "Tema nuevo A"), "registro-curso-nuevo"), AUTHOR_ID);

		Course course = courseRepository.findByName(courseName).orElseThrow();
		assertTrue(topicRepository.findByCourseAndName(course, "Tema nuevo A").isPresent());
		assertTrue(topicRepository.findByCourseAndName(course, "Tema nuevo B").isPresent());

		Resource saved = resourceRepository.findById(dto.id()).orElseThrow();
		assertEquals(AUTHOR_ID, saved.getAuthorId());
		// Los temas se devuelven ordenados por nombre, no en el orden del formulario.
		assertEquals(List.of("Tema nuevo A", "Tema nuevo B"), dto.topics());

		mockMvc.perform(get("/api/resources").param("q", "registro-curso-nuevo"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].course").value(courseName));
	}

	@Test
	void reusesAnExistingCourseAndTopicInsteadOfCreatingDuplicates() throws Exception {
		String courseName = "Curso existente de la prueba de registro";

		ResourceDto first = resourceService.createResource(
				request(courseName, List.of("Tema existente"), "registro-primero"), AUTHOR_ID);
		Resource firstResource = resourceRepository.findById(first.id()).orElseThrow();
		Long courseId = firstResource.getCourse().getId();
		Long topicId = topicRepository.findByCourseAndName(firstResource.getCourse(), "Tema existente")
				.orElseThrow()
				.getId();

		ResourceDto second = resourceService.createResource(
				request(courseName, List.of("Tema existente", "Tema nuevo"), "registro-segundo"), AUTHOR_ID);
		Resource secondResource = resourceRepository.findById(second.id()).orElseThrow();

		assertEquals(courseId, secondResource.getCourse().getId());
		assertEquals(topicId, topicRepository.findByCourseAndName(secondResource.getCourse(), "Tema existente")
				.orElseThrow()
				.getId());

		long coursesWithThatName = courseRepository.findAll().stream()
				.filter(existingCourse -> existingCourse.getName().equals(courseName))
				.count();
		assertEquals(1, coursesWithThatName);
	}

}
