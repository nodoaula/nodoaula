package io.github.nodoaula.catalog;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.catalog.ResourceEntryMethodTests.TestAuthor;
import io.github.nodoaula.shared.error.FieldValidationException;

/**
 * Qué se corrige de un recurso y con qué reglas (historia HU311): en un video,
 * título, descripción, fecha, duración, canal, curso y temas (AB#219); en un
 * apunte, título, descripción, curso y temas, sin tocar su fecha ni su archivo
 * (AB#220). El enlace y la vía de ingreso no cambian nunca, y lo corregido se
 * ve de inmediato en la ficha, el catálogo, los filtros y la búsqueda (AB#221).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResourceCorrectionTests {

	private static final Long AUTHOR_ID = 999L;
	private static final String YOUTUBE_URL = "https://www.youtube.com/watch?v=Zi_XLOBDo_Y";
	private static final String COURSE = "Curso de la prueba de corrección";
	private static final String TOPIC = "Tema de la prueba de corrección";

	@Autowired private MockMvc mockMvc;
	@Autowired private ResourceService resourceService;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private CourseRepository courseRepository;
	@Autowired private TopicRepository topicRepository;

	private Long registerVideo(EntryMethod entryMethod) {
		return resourceService.createResource(new CreateResourceRequest(
				"Titulo con errata de YouTube",
				"Descripción original",
				LocalDate.of(2026, 10, 1),
				600,
				"Canal original",
				YOUTUBE_URL,
				ResourceType.VIDEO,
				COURSE,
				List.of(TOPIC),
				entryMethod), AUTHOR_ID).id();
	}

	// Un apunte se crea a mano y no subiéndolo, para no depender del
	// almacenamiento: lo que se prueba es la corrección, no la subida.
	private Long registerDocument() {
		Course course = courseRepository.save(new Course(COURSE));
		Resource document = Resource.document("Apunte con errata", "Descripción original",
				LocalDate.of(2026, 10, 3), course, AUTHOR_ID,
				new DocumentFile("apunte-de-prueba.pdf", 1234, 5, "a".repeat(64)));
		document.addTopic(topicRepository.save(new Topic(course, TOPIC)));
		return resourceRepository.save(document).getId();
	}

	private static UpdateResourceRequest videoCorrection(String course, List<String> topics) {
		return new UpdateResourceRequest("  Título corregido  ", "  Descripción corregida  ",
				LocalDate.of(2026, 9, 30), 1200, "  Canal corregido  ", course, topics);
	}

	private Resource saved(Long id) {
		return resourceRepository.findById(id).orElseThrow();
	}

	private static MockHttpServletRequestBuilder correct(Long id, String json) {
		return put("/api/resources/" + id)
				.with(authentication(new UsernamePasswordAuthenticationToken(new TestAuthor(AUTHOR_ID), null, List.of())))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(json);
	}

	// --- Video (AB#219) ---

	@Test
	void correctsEveryEditableFieldOfAVideo() {
		Long id = registerVideo(EntryMethod.MANUAL);

		ResourceDetailDto corrected = resourceService.updateResource(id,
				videoCorrection("Otro curso de la prueba de corrección", List.of("Tema nuevo", "Otro tema")), AUTHOR_ID);

		Resource resource = saved(id);
		assertEquals("Título corregido", resource.getTitle());
		assertEquals("Descripción corregida", resource.getDescription());
		assertEquals(LocalDate.of(2026, 9, 30), resource.getPublishedAt());
		assertEquals(1200, resource.getDurationSeconds());
		assertEquals("Canal corregido", resource.getChannel());
		assertEquals("Otro curso de la prueba de corrección", resource.getCourse().getName());
		assertEquals(List.of("Otro tema", "Tema nuevo"), corrected.topics());
	}

	@Test
	void emptyOptionalFieldsAreCleared() {
		Long id = registerVideo(EntryMethod.MANUAL);

		resourceService.updateResource(id, new UpdateResourceRequest("Título", "   ", LocalDate.of(2026, 9, 30),
				null, "", COURSE, List.of(TOPIC)), AUTHOR_ID);

		Resource resource = saved(id);
		assertNull(resource.getDescription());
		assertNull(resource.getDurationSeconds());
		assertNull(resource.getChannel());
	}

	@Test
	void reusesCoursesAndTopicsThatOnlyDifferInCaseOrAccents() {
		Long id = registerVideo(EntryMethod.MANUAL);
		Course seedCourse = courseRepository.findByName("Arquitectura de Software").orElseThrow();
		long coursesBefore = courseRepository.count();
		long topicsBefore = topicRepository.count();

		ResourceDetailDto corrected = resourceService.updateResource(id,
				videoCorrection("  arquitectura de SOFTWARE ", List.of("spring boot", "SPRING BOOT")), AUTHOR_ID);

		assertEquals(seedCourse.getId(), corrected.courseId());
		assertEquals("Arquitectura de Software", corrected.course());
		assertEquals(List.of("Spring Boot"), corrected.topics());
		assertEquals(coursesBefore, courseRepository.count());
		assertEquals(topicsBefore, topicRepository.count());
	}

	@Test
	void aVideoKeepsRequiringItsPublicationDate() {
		Long id = registerVideo(EntryMethod.MANUAL);

		FieldValidationException exception = assertThrows(FieldValidationException.class,
				() -> resourceService.updateResource(id,
						new UpdateResourceRequest("Título", null, null, null, null, COURSE, List.of(TOPIC)), AUTHOR_ID));

		assertEquals("publishedAt", exception.getField());
		assertEquals("Titulo con errata de YouTube", saved(id).getTitle());
	}

	// Las mismas reglas y los mismos mensajes que al registrar (HU308).
	@ParameterizedTest(name = "{0} se rechaza en el campo {1}")
	@CsvSource(delimiter = ';', value = {
			"título vacío;title;{\"title\":\" \",\"publishedAt\":\"2026-10-02\",\"course\":\"Curso\",\"topics\":[\"Tema\"]}",
			"duración cero;durationSeconds;{\"title\":\"T\",\"publishedAt\":\"2026-10-02\",\"durationSeconds\":0,\"course\":\"Curso\",\"topics\":[\"Tema\"]}",
			"curso vacío;course;{\"title\":\"T\",\"publishedAt\":\"2026-10-02\",\"course\":\"\",\"topics\":[\"Tema\"]}",
			"sin temas;topics;{\"title\":\"T\",\"publishedAt\":\"2026-10-02\",\"course\":\"Curso\",\"topics\":[]}",
			"tema en blanco;topics[0];{\"title\":\"T\",\"publishedAt\":\"2026-10-02\",\"course\":\"Curso\",\"topics\":[\" \"]}",
			"sin fecha;publishedAt;{\"title\":\"T\",\"course\":\"Curso\",\"topics\":[\"Tema\"]}",
	})
	void theApiValidatesTheCorrectionLikeTheRegistration(String name, String field, String json) throws Exception {
		Long id = registerVideo(EntryMethod.MANUAL);

		mockMvc.perform(correct(id, json))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[0].field").value(field));
	}

	@Test
	void aTitleLongerThanTheRegistrationAllowsIsRejected() throws Exception {
		Long id = registerVideo(EntryMethod.MANUAL);
		String json = "{\"title\":\"%s\",\"publishedAt\":\"2026-10-02\",\"course\":\"Curso\",\"topics\":[\"Tema\"]}"
				.formatted("x".repeat(301));

		mockMvc.perform(correct(id, json))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("title"))
				.andExpect(jsonPath("$.errors[0].message").value("El título no puede tener más de 300 caracteres."));
	}

	@Test
	void theLinkTypeAndEntryMethodCannotBeChangedThroughTheApi() throws Exception {
		Long id = registerVideo(EntryMethod.AUTOMATIC);
		String json = """
				{
				  "title": "Título corregido",
				  "publishedAt": "2026-10-02",
				  "course": "%s",
				  "topics": ["%s"],
				  "url": "https://www.youtube.com/watch?v=yhUh4ZmM45w",
				  "resourceType": "DOCUMENT",
				  "entryMethod": "MANUAL"
				}
				""".formatted(COURSE, TOPIC);

		mockMvc.perform(correct(id, json))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.url").value(YOUTUBE_URL))
				.andExpect(jsonPath("$.resourceType").value("VIDEO"));

		Resource resource = saved(id);
		assertEquals(YOUTUBE_URL, resource.getUrl());
		assertEquals(ResourceType.VIDEO, resource.getResourceType());
		assertEquals(EntryMethod.AUTOMATIC, resource.getEntryMethod());
		assertEquals(AUTHOR_ID, resource.getAuthorId());
	}

	@Test
	void correctingAnIndexedVideoKeepsItAsAutomatic() {
		Long id = registerVideo(EntryMethod.AUTOMATIC);

		resourceService.updateResource(id, videoCorrection(COURSE, List.of(TOPIC)), AUTHOR_ID);

		assertEquals(EntryMethod.AUTOMATIC, saved(id).getEntryMethod());
	}

	// --- Apunte (AB#220) ---

	@Test
	void correctsTheTitleDescriptionCourseAndTopicsOfADocument() {
		Long id = registerDocument();
		DocumentFile fileBefore = saved(id).getFile();

		resourceService.updateResource(id, new UpdateResourceRequest("  Apunte corregido ", "Nueva descripción",
				null, null, null, "Otro curso del apunte", List.of("Tema del apunte")), AUTHOR_ID);

		Resource resource = saved(id);
		assertEquals("Apunte corregido", resource.getTitle());
		assertEquals("Nueva descripción", resource.getDescription());
		assertEquals("Otro curso del apunte", resource.getCourse().getName());
		assertEquals(List.of("Tema del apunte"), resource.getTopics().stream().map(Topic::getName).toList());
		assertEquals(LocalDate.of(2026, 10, 3), resource.getPublishedAt(), "la fecha es la de la subida");
		assertEquals(fileBefore, resource.getFile(), "el archivo no cambia");
		assertNull(resource.getUrl());
		assertEquals(ResourceType.DOCUMENT, resource.getResourceType());
		assertEquals(EntryMethod.MANUAL, resource.getEntryMethod());
	}

	@ParameterizedTest(name = "en un apunte se rechaza {0}")
	@CsvSource({ "publishedAt", "durationSeconds", "channel" })
	void aDocumentRejectsTheFieldsThatOnlyAVideoHas(String field) {
		Long id = registerDocument();
		UpdateResourceRequest request = new UpdateResourceRequest("Apunte corregido", null,
				field.equals("publishedAt") ? LocalDate.of(2026, 1, 1) : null,
				field.equals("durationSeconds") ? 60 : null,
				field.equals("channel") ? "Un canal" : null,
				COURSE, List.of(TOPIC));

		FieldValidationException exception = assertThrows(FieldValidationException.class,
				() -> resourceService.updateResource(id, request, AUTHOR_ID));

		assertEquals(field, exception.getField());
		assertEquals("Apunte con errata", saved(id).getTitle());
		assertEquals(LocalDate.of(2026, 10, 3), saved(id).getPublishedAt());
	}

	@Test
	void theApiRejectsChangingTheDateOfADocumentOnTheField() throws Exception {
		Long id = registerDocument();
		String json = """
				{"title": "Apunte", "publishedAt": "2026-01-01", "course": "%s", "topics": ["%s"]}
				""".formatted(COURSE, TOPIC);

		mockMvc.perform(correct(id, json))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[0].field").value("publishedAt"))
				.andExpect(jsonPath("$.errors[0].message").value("La fecha de un apunte es la de su subida y no se cambia."));
	}

	// --- Se ve de inmediato (AB#221) ---

	@Test
	void theCorrectionIsVisibleRightAwayInTheDetailTheCatalogAndTheSearch() throws Exception {
		Long id = registerVideo(EntryMethod.MANUAL);
		String json = """
				{
				  "title": "Videoclase corregida de grafos",
				  "publishedAt": "2026-10-02",
				  "course": "Curso corregido de la prueba",
				  "topics": ["Grafos corregidos"]
				}
				""";

		mockMvc.perform(correct(id, json)).andExpect(status().isOk());

		mockMvc.perform(get("/api/resources/" + id))
				.andExpect(jsonPath("$.title").value("Videoclase corregida de grafos"))
				.andExpect(jsonPath("$.course").value("Curso corregido de la prueba"))
				.andExpect(jsonPath("$.topics[0]").value("Grafos corregidos"));

		mockMvc.perform(get("/api/resources"))
				.andExpect(jsonPath("$[?(@.id == %d)].title".formatted(id)).value("Videoclase corregida de grafos"));

		mockMvc.perform(get("/api/resources").param("q", "grafos corregidos"))
				.andExpect(jsonPath("$[*].id").value(hasItem(id.intValue())));
		mockMvc.perform(get("/api/resources").param("q", "errata de youtube"))
				.andExpect(jsonPath("$[*].id").value(not(hasItem(id.intValue()))));
	}

	@Test
	void theFiltersFollowTheCorrectedCourseAndTopics() throws Exception {
		Long id = registerVideo(EntryMethod.MANUAL);
		Long oldCourseId = saved(id).getCourse().getId();
		Long oldTopicId = saved(id).getTopics().iterator().next().getId();

		ResourceDetailDto corrected = resourceService.updateResource(id,
				videoCorrection("Curso corregido de los filtros", List.of("Tema corregido de los filtros")), AUTHOR_ID);
		Long newTopicId = saved(id).getTopics().iterator().next().getId();

		mockMvc.perform(get("/api/resources").param("courseId", corrected.courseId().toString()))
				.andExpect(jsonPath("$[*].id").value(hasItem(id.intValue())));
		mockMvc.perform(get("/api/resources").param("topicId", newTopicId.toString()))
				.andExpect(jsonPath("$[*].id").value(hasItem(id.intValue())));
		mockMvc.perform(get("/api/resources").param("courseId", oldCourseId.toString()))
				.andExpect(jsonPath("$[*].id").value(not(hasItem(id.intValue()))));

		// El curso y el tema de antes se quedaron sin recursos: dejan de
		// ofrecerse en los selectores del catálogo.
		mockMvc.perform(get("/api/resources/courses"))
				.andExpect(jsonPath("$[*].name").value(hasItem("Curso corregido de los filtros")))
				.andExpect(jsonPath("$[*].id").value(not(hasItem(oldCourseId.intValue()))));
		mockMvc.perform(get("/api/resources/topics"))
				.andExpect(jsonPath("$[*].name").value(hasItem("Tema corregido de los filtros")))
				.andExpect(jsonPath("$[*].id").value(not(hasItem(oldTopicId.intValue()))));
	}

}
