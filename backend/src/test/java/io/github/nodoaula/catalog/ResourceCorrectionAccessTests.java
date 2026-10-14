package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.catalog.ResourceEntryMethodTests.TestAuthor;

/**
 * Quién puede corregir un recurso (historia HU311, AB#218): quien lo aportó y
 * las cuentas del equipo, incluidos los del catálogo semilla, que no tienen un
 * autor con cuenta; nadie más, y la API lo rechaza con 403. La ficha dice a
 * quien la ve si puede corregirlo.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResourceCorrectionAccessTests {

	private static final Long AUTHOR_ID = 999L;
	private static final Long OTHER_ID = 998L;
	private static final String TITLE = "Video de la prueba de acceso a la corrección";
	private static final String SEED_TITLE = "Spring Boot 2026-2";

	@Autowired private MockMvc mockMvc;
	@Autowired private ResourceService resourceService;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long resourceId;

	@BeforeEach
	void registerAVideo() {
		resourceId = resourceService.createResource(new CreateResourceRequest(
				TITLE,
				null,
				LocalDate.of(2026, 10, 1),
				600,
				null,
				"https://www.youtube.com/watch?v=Zi_XLOBDo_Y",
				ResourceType.VIDEO,
				"Curso de la prueba de acceso a la corrección",
				List.of("Tema de la prueba")), AUTHOR_ID).id();
	}

	private static UpdateResourceRequest correction(String title) {
		return new UpdateResourceRequest(title, null, LocalDate.of(2026, 10, 2), 600, null,
				"Curso de la prueba de acceso a la corrección", List.of("Tema de la prueba"));
	}

	private static String correctionJson(String title) {
		return """
				{
				  "title": "%s",
				  "publishedAt": "2026-10-02",
				  "course": "Curso de la prueba de acceso a la corrección",
				  "topics": ["Tema de la prueba"]
				}
				""".formatted(title);
	}

	private static RequestPostProcessor signedInAs(Long accountId) {
		return authentication(new UsernamePasswordAuthenticationToken(new TestAuthor(accountId), null, List.of()));
	}

	// La marca solo se pone en la base de datos, como en el entorno desplegado.
	private Long teamAccount() {
		return jdbcTemplate.queryForObject(
				"insert into accounts (email, password_hash, created_at, team_member) "
						+ "values ('equipo-hu311@ejemplo.com', '{noop}sin-uso', now(), true) returning id",
				Long.class);
	}

	private Long seedResourceId() {
		return resourceRepository.findAll().stream()
				.filter(resource -> resource.getTitle().equals(SEED_TITLE))
				.findFirst()
				.orElseThrow()
				.getId();
	}

	private String savedTitle(Long id) {
		return resourceRepository.findById(id).orElseThrow().getTitle();
	}

	@Test
	void theAuthorCanCorrectTheirResource() {
		ResourceDetailDto corrected = resourceService.updateResource(resourceId, correction("Título corregido"), AUTHOR_ID);

		assertEquals("Título corregido", corrected.title());
		assertEquals("Título corregido", savedTitle(resourceId));
	}

	@Test
	void aTeamAccountCanCorrectAResourceItDidNotContribute() {
		resourceService.updateResource(resourceId, correction("Corregido por el equipo"), teamAccount());

		assertEquals("Corregido por el equipo", savedTitle(resourceId));
	}

	@Test
	void aTeamAccountCanCorrectASeedResource() {
		Long seedId = seedResourceId();
		UpdateResourceRequest request = new UpdateResourceRequest("Spring Boot 2026-2, corregido", null,
				LocalDate.of(2026, 9, 16), null, null, "Arquitectura de Software", List.of("Spring Boot"));

		resourceService.updateResource(seedId, request, teamAccount());

		assertEquals("Spring Boot 2026-2, corregido", savedTitle(seedId));
	}

	@Test
	void anAccountThatIsNotTheAuthorNorFromTheTeamCannotCorrect() {
		assertThrows(ResourceChangeForbiddenException.class,
				() -> resourceService.updateResource(resourceId, correction("Ajeno"), OTHER_ID));

		assertEquals(TITLE, savedTitle(resourceId));
	}

	@Test
	void noOrdinaryAccountCanCorrectASeedResource() {
		Long seedId = seedResourceId();

		assertThrows(ResourceChangeForbiddenException.class,
				() -> resourceService.updateResource(seedId, correction("Ajeno"), AUTHOR_ID));

		assertEquals(SEED_TITLE, savedTitle(seedId));
	}

	@Test
	void theApiRejectsSomeoneElsesCorrectionWithA403AndItsCode() throws Exception {
		mockMvc.perform(put("/api/resources/" + resourceId)
				.with(signedInAs(OTHER_ID))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(correctionJson("Ajeno")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("RESOURCE_CHANGE_FORBIDDEN"));

		assertEquals(TITLE, savedTitle(resourceId));
	}

	@Test
	void theApiAcceptsTheAuthorsCorrectionAndReturnsTheCorrectedDetail() throws Exception {
		mockMvc.perform(put("/api/resources/" + resourceId)
				.with(signedInAs(AUTHOR_ID))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(correctionJson("Corregido por HTTP")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("Corregido por HTTP"))
				.andExpect(jsonPath("$.canEdit").value(true));
	}

	@Test
	void correctingWithoutASessionIsA401() throws Exception {
		mockMvc.perform(put("/api/resources/" + resourceId)
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(correctionJson("Sin sesión")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	@Test
	void correctingWithoutTheCsrfTokenIsRejectedAsSuch() throws Exception {
		mockMvc.perform(put("/api/resources/" + resourceId)
				.with(signedInAs(AUTHOR_ID))
				.contentType(MediaType.APPLICATION_JSON)
				.content(correctionJson("Sin token")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));

		assertEquals(TITLE, savedTitle(resourceId));
	}

	@Test
	void correctingAResourceThatDoesNotExistIsA404() throws Exception {
		mockMvc.perform(put("/api/resources/999999999")
				.with(signedInAs(AUTHOR_ID))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(correctionJson("No existe")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
	}

	@Test
	void theDetailTellsWhoCanCorrectTheResource() throws Exception {
		String path = "/api/resources/" + resourceId;

		mockMvc.perform(get(path)).andExpect(jsonPath("$.canEdit").value(false));
		mockMvc.perform(get(path).with(signedInAs(OTHER_ID))).andExpect(jsonPath("$.canEdit").value(false));
		mockMvc.perform(get(path).with(signedInAs(AUTHOR_ID))).andExpect(jsonPath("$.canEdit").value(true));
		mockMvc.perform(get(path).with(signedInAs(teamAccount()))).andExpect(jsonPath("$.canEdit").value(true));
	}

	@Test
	void aSeedResourceDetailIsOnlyCorrectableByTheTeam() throws Exception {
		String path = "/api/resources/" + seedResourceId();

		mockMvc.perform(get(path).with(signedInAs(AUTHOR_ID))).andExpect(jsonPath("$.canEdit").value(false));
		mockMvc.perform(get(path).with(signedInAs(teamAccount()))).andExpect(jsonPath("$.canEdit").value(true));
	}

}
