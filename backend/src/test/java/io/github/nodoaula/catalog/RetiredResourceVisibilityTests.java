package io.github.nodoaula.catalog;

import static io.github.nodoaula.catalog.RetirementTestSupport.AUTHOR_ID;
import static io.github.nodoaula.catalog.RetirementTestSupport.registerVideo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/**
 * Un recurso retirado deja de aparecer en el catálogo, la búsqueda, los cursos
 * y los temas, y al volver a publicarlo reaparece en todos (historia HU307).
 * El índice de cursos, la página de un curso, la portada, los resúmenes por
 * curso y los filtros de tema del frontend se calculan sobre estas mismas
 * respuestas, así que basta con probarlas aquí.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RetiredResourceVisibilityTests {

	private static final String TITLE = "Video de la prueba de visibilidad del retiro";
	private static final String COURSE = "Curso de la prueba de visibilidad del retiro";
	private static final String ONLY_TOPIC = "Tema solo del recurso retirado";
	private static final String SHARED_TOPIC = "Tema compartido de la prueba";

	@Autowired private MockMvc mockMvc;
	@Autowired private ResourceService resourceService;
	@Autowired private ResourceRepository resourceRepository;

	private Long resourceId;
	private int courseId;
	private int onlyTopicId;

	@BeforeEach
	void registerAVideo() {
		resourceId = registerVideo(resourceService, TITLE, "hu307Visibl", COURSE, List.of(ONLY_TOPIC, SHARED_TOPIC));
		Resource resource = resourceRepository.findById(resourceId).orElseThrow();
		courseId = resource.getCourse().getId().intValue();
		onlyTopicId = resource.getTopics().stream()
				.filter(topic -> topic.getName().equals(ONLY_TOPIC))
				.findFirst()
				.orElseThrow()
				.getId()
				.intValue();
	}

	private ResultActions perform(String path, String... params) throws Exception {
		var request = get(path);
		for (int i = 0; i < params.length; i += 2) {
			request = request.param(params[i], params[i + 1]);
		}
		return mockMvc.perform(request).andExpect(status().isOk());
	}

	private void assertListed(boolean listed) throws Exception {
		var id = hasItem(resourceId.intValue());
		var listedId = listed ? id : not(id);
		var course = hasItem(courseId);
		var topic = hasItem(onlyTopicId);

		// Catálogo completo (índice de cursos y portada), curso, tema y búsqueda.
		perform("/api/resources").andExpect(jsonPath("$[*].id", listedId));
		perform("/api/resources", "courseId", String.valueOf(courseId)).andExpect(jsonPath("$[*].id", listedId));
		perform("/api/resources", "topicId", String.valueOf(onlyTopicId)).andExpect(jsonPath("$[*].id", listedId));
		perform("/api/resources", "q", TITLE).andExpect(jsonPath("$[*].id", listedId));

		// Selectores de curso y de tema, con y sin curso elegido.
		perform("/api/resources/courses").andExpect(jsonPath("$[*].id", listed ? course : not(course)));
		perform("/api/resources/topics").andExpect(jsonPath("$[*].id", listed ? topic : not(topic)));
		perform("/api/resources/topics", "courseId", String.valueOf(courseId))
				.andExpect(jsonPath("$[*].id", listed ? topic : not(topic)));
	}

	@Test
	void aPublishedResourceIsListedEverywhere() throws Exception {
		assertListed(true);
	}

	@Test
	void aRetiredResourceDisappearsFromTheCatalogTheSearchTheCoursesAndTheTopics() throws Exception {
		resourceService.retireResource(resourceId, AUTHOR_ID);

		assertListed(false);
	}

	@Test
	void aRepublishedResourceReappearsEverywhere() throws Exception {
		resourceService.retireResource(resourceId, AUTHOR_ID);
		resourceService.republishResource(resourceId, AUTHOR_ID);

		assertListed(true);
	}

	// Un curso o tema con otro recurso publicado sigue en los selectores; solo
	// sale el tema que se quedó sin ninguno.
	@Test
	void aCourseOrTopicWithAnotherPublishedResourceStays() throws Exception {
		Long otherId = registerVideo(resourceService, "Otro video de la prueba de visibilidad", "hu307Otro01", COURSE,
				List.of(SHARED_TOPIC));

		resourceService.retireResource(resourceId, AUTHOR_ID);

		perform("/api/resources", "courseId", String.valueOf(courseId))
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].id").value(otherId));
		perform("/api/resources/courses").andExpect(jsonPath("$[*].id", hasItem(courseId)));
		perform("/api/resources/topics", "courseId", String.valueOf(courseId))
				.andExpect(jsonPath("$[*].name", hasItem(SHARED_TOPIC)))
				.andExpect(jsonPath("$[*].name", not(hasItem(ONLY_TOPIC))));
	}

}
