package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.shared.error.FieldValidationException;

/**
 * Cubre el registro de la vía de ingreso al publicar (historia HU202): la
 * que envía el formulario se guarda, sin ella queda manual, y solo un enlace
 * de YouTube puede registrarse como indexado automáticamente.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResourceEntryMethodTests {

	private static final Long AUTHOR_ID = 999L;
	private static final String YOUTUBE_URL = "https://www.youtube.com/watch?v=FWQi5MJ1erQ";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ResourceService resourceService;

	@Autowired
	private ResourceRepository resourceRepository;

	private static CreateResourceRequest request(String url, EntryMethod entryMethod) {
		return new CreateResourceRequest(
				"Recurso de la prueba de vía de ingreso",
				null,
				LocalDate.of(2026, 10, 1),
				600,
				"Canal de la prueba",
				url,
				ResourceType.VIDEO,
				"Curso de la prueba de vía de ingreso",
				List.of("Tema de la prueba"),
				entryMethod);
	}

	private EntryMethod savedEntryMethod(ResourceDto dto) {
		return resourceRepository.findById(dto.id()).orElseThrow().getEntryMethod();
	}

	@Test
	void storesAnAutomaticEntry() {
		ResourceDto dto = resourceService.createResource(request(YOUTUBE_URL, EntryMethod.AUTOMATIC), AUTHOR_ID);

		assertEquals(EntryMethod.AUTOMATIC, savedEntryMethod(dto));
	}

	@Test
	void storesAManualEntry() {
		ResourceDto dto = resourceService.createResource(request(YOUTUBE_URL, EntryMethod.MANUAL), AUTHOR_ID);

		assertEquals(EntryMethod.MANUAL, savedEntryMethod(dto));
	}

	@Test
	void withoutAnEntryMethodTheResourceIsManual() {
		ResourceDto dto = resourceService.createResource(
				request("https://ejemplo.com/apunte.pdf", null), AUTHOR_ID);

		assertEquals(EntryMethod.MANUAL, savedEntryMethod(dto));
	}

	@Test
	void rejectsAnAutomaticEntryWithALinkThatIsNotFromYouTube() {
		long resourcesBefore = resourceRepository.count();

		FieldValidationException exception = assertThrows(FieldValidationException.class,
				() -> resourceService.createResource(
						request("https://vimeo.com/76979871", EntryMethod.AUTOMATIC), AUTHOR_ID));

		assertEquals("entryMethod", exception.getField());
		assertEquals(resourcesBefore, resourceRepository.count());
	}

	@Test
	void theRejectionReachesTheClientAsAValidationErrorOnTheField() throws Exception {
		String body = """
				{
				  "title": "Recurso de la prueba HTTP de vía de ingreso",
				  "publishedAt": "2026-10-01",
				  "url": "https://vimeo.com/76979871",
				  "resourceType": "VIDEO",
				  "course": "Curso de la prueba de vía de ingreso",
				  "topics": ["Tema de la prueba"],
				  "entryMethod": "AUTOMATIC"
				}
				""";

		mockMvc.perform(post("/api/resources")
				.with(authentication(new UsernamePasswordAuthenticationToken(new TestAuthor(AUTHOR_ID), null, List.of())))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[0].field").value("entryMethod"));
	}

	@Test
	void anHttpRequestWithoutEntryMethodIsStoredAsManual() throws Exception {
		String body = """
				{
				  "title": "Recurso de la prueba HTTP sin vía de ingreso",
				  "publishedAt": "2026-10-01",
				  "url": "%s",
				  "resourceType": "VIDEO",
				  "course": "Curso de la prueba de vía de ingreso",
				  "topics": ["Tema de la prueba"]
				}
				""".formatted(YOUTUBE_URL);

		mockMvc.perform(post("/api/resources")
				.with(authentication(new UsernamePasswordAuthenticationToken(new TestAuthor(AUTHOR_ID), null, List.of())))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
				.andExpect(status().isCreated());

		Resource saved = resourceRepository.findAll().stream()
				.filter(resource -> resource.getTitle().equals("Recurso de la prueba HTTP sin vía de ingreso"))
				.findFirst()
				.orElseThrow();
		assertEquals(EntryMethod.MANUAL, saved.getEntryMethod());
	}

	/**
	 * Hace de cuenta con sesión iniciada. El controlador lee el autor con
	 * @AuthenticationPrincipal(expression = "id"), por reflexión, así que basta
	 * con un getId público; el principal real es interno del módulo account.
	 */
	public static final class TestAuthor {

		private final Long id;

		TestAuthor(Long id) {
			this.id = id;
		}

		public Long getId() {
			return id;
		}

	}

}
