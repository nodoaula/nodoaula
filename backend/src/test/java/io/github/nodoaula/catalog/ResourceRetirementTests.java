package io.github.nodoaula.catalog;

import static io.github.nodoaula.catalog.RetirementTestSupport.AUTHOR_ID;
import static io.github.nodoaula.catalog.RetirementTestSupport.OTHER_ID;
import static io.github.nodoaula.catalog.RetirementTestSupport.SEED_TITLE;
import static io.github.nodoaula.catalog.RetirementTestSupport.registerVideo;
import static io.github.nodoaula.catalog.RetirementTestSupport.seedResourceId;
import static io.github.nodoaula.catalog.RetirementTestSupport.signedInAs;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.transaction.annotation.Transactional;

/**
 * Retirar un recurso (historia HU307): quien lo aportó y las cuentas del
 * equipo, incluidos los del catálogo semilla; nadie más, y la API lo rechaza
 * con 403. El retiro es lógico: la fila se conserva. La ficha de un recurso
 * retirado dice que no está disponible, sin su contenido, y no se corrige.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResourceRetirementTests {

	private static final String TITLE = "Video de la prueba del retiro";

	@Autowired private MockMvc mockMvc;
	@Autowired private ResourceService resourceService;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long resourceId;

	@BeforeEach
	void registerAVideo() {
		resourceId = registerVideo(resourceService, TITLE, "hu307Retiro", "Curso de la prueba del retiro",
				List.of("Tema de la prueba del retiro"));
	}

	private Long teamAccount() {
		return RetirementTestSupport.teamAccount(jdbcTemplate, "equipo-hu307-retiro@ejemplo.com");
	}

	private Resource saved(Long id) {
		return resourceRepository.findById(id).orElseThrow();
	}

	@Test
	void theAuthorCanRetireTheirResourceAndTheRecordStays() {
		ResourceDetailDto retired = resourceService.retireResource(resourceId, AUTHOR_ID);

		assertTrue(retired.retired());
		assertTrue(retired.canRepublish());

		// Lógico: la fila y sus temas siguen ahí, con quién lo retiró.
		Resource resource = saved(resourceId);
		assertTrue(resource.isRetired());
		assertEquals(AUTHOR_ID, resource.getRetiredBy());
		assertEquals(TITLE, resource.getTitle());
		assertEquals(1, resource.getTopics().size());
	}

	@Test
	void aTeamAccountCanRetireAResourceItDidNotContribute() {
		Long team = teamAccount();

		resourceService.retireResource(resourceId, team);

		assertTrue(saved(resourceId).isRetired());
		assertEquals(team, saved(resourceId).getRetiredBy());
	}

	@Test
	void aTeamAccountCanRetireASeedResource() {
		Long seedId = seedResourceId(resourceRepository);

		resourceService.retireResource(seedId, teamAccount());

		assertTrue(saved(seedId).isRetired());
	}

	@Test
	void anAccountThatIsNotTheAuthorNorFromTheTeamCannotRetire() {
		assertThrows(ResourceChangeForbiddenException.class,
				() -> resourceService.retireResource(resourceId, OTHER_ID));

		assertFalse(saved(resourceId).isRetired());
	}

	@Test
	void noOrdinaryAccountCanRetireASeedResource() {
		Long seedId = seedResourceId(resourceRepository);

		assertThrows(ResourceChangeForbiddenException.class,
				() -> resourceService.retireResource(seedId, AUTHOR_ID));

		assertFalse(saved(seedId).isRetired());
		assertEquals(SEED_TITLE, saved(seedId).getTitle());
	}

	@Test
	void theApiRetiresTheResourceAndReturnsItsRetiredDetail() throws Exception {
		mockMvc.perform(post("/api/resources/" + resourceId + "/retire")
				.with(signedInAs(AUTHOR_ID))
				.with(csrf()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.retired").value(true))
				.andExpect(jsonPath("$.title").value(TITLE))
				.andExpect(jsonPath("$.canRepublish").value(true))
				.andExpect(jsonPath("$.canRetire").value(false))
				.andExpect(jsonPath("$.canEdit").value(false));

		assertTrue(saved(resourceId).isRetired());
	}

	@Test
	void theApiRejectsSomeoneElsesRetirementWithA403AndItsCode() throws Exception {
		mockMvc.perform(post("/api/resources/" + resourceId + "/retire")
				.with(signedInAs(OTHER_ID))
				.with(csrf()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("RESOURCE_CHANGE_FORBIDDEN"));

		assertFalse(saved(resourceId).isRetired());
	}

	@Test
	void retiringWithoutASessionIsA401() throws Exception {
		mockMvc.perform(post("/api/resources/" + resourceId + "/retire").with(csrf()))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

		assertFalse(saved(resourceId).isRetired());
	}

	@Test
	void retiringWithoutTheCsrfTokenIsRejectedAsSuch() throws Exception {
		mockMvc.perform(post("/api/resources/" + resourceId + "/retire").with(signedInAs(AUTHOR_ID)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));

		assertFalse(saved(resourceId).isRetired());
	}

	@Test
	void retiringAResourceThatDoesNotExistIsA404() throws Exception {
		mockMvc.perform(post("/api/resources/999999999/retire")
				.with(signedInAs(AUTHOR_ID))
				.with(csrf()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
	}

	@Test
	void retiringAnAlreadyRetiredResourceIsA409() throws Exception {
		resourceService.retireResource(resourceId, AUTHOR_ID);

		mockMvc.perform(post("/api/resources/" + resourceId + "/retire")
				.with(signedInAs(AUTHOR_ID))
				.with(csrf()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("RESOURCE_RETIRED"));
	}

	// El permiso va antes que el estado: a quien no puede retirarlo no se le
	// cuenta si ya está retirado.
	@Test
	void someoneWhoCannotRetireItGetsA403EvenIfItIsAlreadyRetired() throws Exception {
		resourceService.retireResource(resourceId, AUTHOR_ID);

		mockMvc.perform(post("/api/resources/" + resourceId + "/retire")
				.with(signedInAs(OTHER_ID))
				.with(csrf()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("RESOURCE_CHANGE_FORBIDDEN"));
	}

	@Test
	void theDetailTellsWhoCanRetireTheResource() throws Exception {
		String path = "/api/resources/" + resourceId;

		mockMvc.perform(get(path)).andExpect(jsonPath("$.canRetire").value(false));
		mockMvc.perform(get(path).with(signedInAs(OTHER_ID))).andExpect(jsonPath("$.canRetire").value(false));
		mockMvc.perform(get(path).with(signedInAs(AUTHOR_ID)))
				.andExpect(jsonPath("$.canRetire").value(true))
				.andExpect(jsonPath("$.retired").value(false))
				.andExpect(jsonPath("$.canRepublish").value(false));
		mockMvc.perform(get(path).with(signedInAs(teamAccount()))).andExpect(jsonPath("$.canRetire").value(true));
	}

	@Test
	void theDetailOfARetiredResourceSaysItIsNotAvailableWithoutItsContent() throws Exception {
		resourceService.retireResource(resourceId, AUTHOR_ID);
		String path = "/api/resources/" + resourceId;

		// Por enlace directo, sin sesión o con otra cuenta: 200, retirado y vacío.
		mockMvc.perform(get(path))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(resourceId))
				.andExpect(jsonPath("$.retired").value(true))
				.andExpect(jsonPath("$.title").value(nullValue()))
				.andExpect(jsonPath("$.url").value(nullValue()))
				.andExpect(jsonPath("$.course").value(nullValue()))
				.andExpect(jsonPath("$.topics.length()").value(0))
				.andExpect(jsonPath("$.canEdit").value(false))
				.andExpect(jsonPath("$.canRetire").value(false))
				.andExpect(jsonPath("$.canRepublish").value(false));
		mockMvc.perform(get(path).with(signedInAs(OTHER_ID)))
				.andExpect(jsonPath("$.title").value(nullValue()))
				.andExpect(jsonPath("$.canRepublish").value(false));

		// Quien lo retiró ve el título, para saber cuál vuelve a publicar.
		mockMvc.perform(get(path).with(signedInAs(AUTHOR_ID)))
				.andExpect(jsonPath("$.title").value(TITLE))
				.andExpect(jsonPath("$.url").value(nullValue()))
				.andExpect(jsonPath("$.canRepublish").value(true));
	}

	@Test
	void correctingARetiredResourceIsA409AndChangesNothing() throws Exception {
		resourceService.retireResource(resourceId, AUTHOR_ID);

		mockMvc.perform(put("/api/resources/" + resourceId)
				.with(signedInAs(AUTHOR_ID))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "title": "Corregido estando retirado",
						  "publishedAt": "2026-10-02",
						  "course": "Curso de la prueba del retiro",
						  "topics": ["Tema de la prueba del retiro"]
						}
						"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("RESOURCE_RETIRED"));

		assertEquals(TITLE, saved(resourceId).getTitle());
	}

}
