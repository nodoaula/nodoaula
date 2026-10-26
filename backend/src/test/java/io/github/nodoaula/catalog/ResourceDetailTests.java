package io.github.nodoaula.catalog;

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

// @Transactional deshace al terminar cada prueba lo que haya escrito, así que
// puede correr contra la base local sin dejar recursos de prueba en ella.
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResourceDetailTests {

	private static final String COURSE = "Curso de la prueba de la ficha";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ResourceService resourceService;

	@Autowired
	private CourseRepository courseRepository;

	@Test
	void detailIncludesTheCourseIdToLinkToTheFilteredCatalog() throws Exception {
		ResourceDto created = resourceService.createResource(new CreateResourceRequest(
				"Recurso de la prueba de la ficha",
				null,
				LocalDate.of(2026, 10, 1),
				null,
				null,
				"https://www.youtube.com/watch?v=gJrjgg1KVL4",
				ResourceType.VIDEO,
				COURSE,
				List.of("Tema de la ficha")), 0L);
		Long courseId = courseRepository.findByName(COURSE).orElseThrow().getId();

		mockMvc.perform(get("/api/resources/" + created.id()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.courseId").value(courseId))
				.andExpect(jsonPath("$.course").value(COURSE));
	}

}
