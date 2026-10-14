package io.github.nodoaula.catalog;

import static io.github.nodoaula.catalog.RetirementTestSupport.AUTHOR_ID;
import static io.github.nodoaula.catalog.RetirementTestSupport.OTHER_ID;
import static io.github.nodoaula.catalog.RetirementTestSupport.registerVideo;
import static io.github.nodoaula.catalog.RetirementTestSupport.signedInAs;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Volver a publicar un recurso retirado (historia HU307): solo la cuenta que
 * lo retiró, mientras conserve el permiso sobre él. Lo que el equipo retiró
 * no lo devuelve quien lo aportó, y uno publicado no se vuelve a publicar.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResourceRepublishTests {

	private static final String TITLE = "Video de la prueba de volver a publicar";

	@Autowired private MockMvc mockMvc;
	@Autowired private ResourceService resourceService;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long resourceId;

	@BeforeEach
	void registerAVideo() {
		resourceId = registerVideo(resourceService, TITLE, "hu307Volver", "Curso de la prueba de volver a publicar",
				List.of("Tema de la prueba de volver a publicar"));
	}

	private Long teamAccount(String email) {
		return RetirementTestSupport.teamAccount(jdbcTemplate, email);
	}

	private boolean isRetired() {
		return resourceRepository.findById(resourceId).orElseThrow().isRetired();
	}

	@Test
	void theAuthorWhoRetiredItCanRepublishIt() {
		resourceService.retireResource(resourceId, AUTHOR_ID);

		ResourceDetailDto republished = resourceService.republishResource(resourceId, AUTHOR_ID);

		assertFalse(republished.retired());
		assertTrue(republished.canRetire());
		assertFalse(isRetired());
	}

	@Test
	void theTeamAccountThatRetiredItCanRepublishIt() {
		Long team = teamAccount("equipo-hu307-volver@ejemplo.com");
		resourceService.retireResource(resourceId, team);

		resourceService.republishResource(resourceId, team);

		assertFalse(isRetired());
	}

	@Test
	void whenTheTeamRetiredItTheAuthorCannotRepublishIt() {
		resourceService.retireResource(resourceId, teamAccount("equipo-hu307-volver@ejemplo.com"));

		assertThrows(ResourceRepublishForbiddenException.class,
				() -> resourceService.republishResource(resourceId, AUTHOR_ID));

		assertTrue(isRetired());
	}

	@Test
	void anotherTeamAccountCannotRepublishWhatOneRetired() {
		resourceService.retireResource(resourceId, teamAccount("equipo-hu307-a@ejemplo.com"));
		Long otherTeam = teamAccount("equipo-hu307-b@ejemplo.com");

		assertThrows(ResourceRepublishForbiddenException.class,
				() -> resourceService.republishResource(resourceId, otherTeam));

		assertTrue(isRetired());
	}

	// Desmarcar una cuenta en la base surte efecto sin que vuelva a iniciar
	// sesión: ya no devuelve lo que retiró de otros.
	@Test
	void aTeamAccountThatLosesTheMarkCannotRepublishWhatItRetiredFromOthers() {
		Long team = teamAccount("equipo-hu307-volver@ejemplo.com");
		resourceService.retireResource(resourceId, team);
		jdbcTemplate.update("update accounts set team_member = false where id = ?", team);

		assertThrows(ResourceRepublishForbiddenException.class,
				() -> resourceService.republishResource(resourceId, team));

		assertTrue(isRetired());
	}

	@Test
	void theApiRepublishesItAndReturnsTheFullDetail() throws Exception {
		resourceService.retireResource(resourceId, AUTHOR_ID);

		mockMvc.perform(post("/api/resources/" + resourceId + "/republish")
				.with(signedInAs(AUTHOR_ID))
				.with(csrf()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.retired").value(false))
				.andExpect(jsonPath("$.title").value(TITLE))
				.andExpect(jsonPath("$.url").value("https://www.youtube.com/watch?v=hu307Volver"))
				.andExpect(jsonPath("$.canRetire").value(true))
				.andExpect(jsonPath("$.canRepublish").value(false));

		assertFalse(isRetired());
	}

	@Test
	void theApiRejectsSomeoneElsesRepublishWithA403AndItsCode() throws Exception {
		resourceService.retireResource(resourceId, AUTHOR_ID);

		mockMvc.perform(post("/api/resources/" + resourceId + "/republish")
				.with(signedInAs(OTHER_ID))
				.with(csrf()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("RESOURCE_REPUBLISH_FORBIDDEN"));

		assertTrue(isRetired());
	}

	@Test
	void republishingAPublishedResourceIsA409() throws Exception {
		mockMvc.perform(post("/api/resources/" + resourceId + "/republish")
				.with(signedInAs(AUTHOR_ID))
				.with(csrf()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("RESOURCE_NOT_RETIRED"));
	}

	@Test
	void republishingWithoutASessionIsA401() throws Exception {
		resourceService.retireResource(resourceId, AUTHOR_ID);

		mockMvc.perform(post("/api/resources/" + resourceId + "/republish").with(csrf()))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

		assertTrue(isRetired());
	}

	@Test
	void republishingWithoutTheCsrfTokenIsRejectedAsSuch() throws Exception {
		resourceService.retireResource(resourceId, AUTHOR_ID);

		mockMvc.perform(post("/api/resources/" + resourceId + "/republish").with(signedInAs(AUTHOR_ID)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));

		assertTrue(isRetired());
	}

	@Test
	void republishingAResourceThatDoesNotExistIsA404() throws Exception {
		mockMvc.perform(post("/api/resources/999999999/republish")
				.with(signedInAs(AUTHOR_ID))
				.with(csrf()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
	}

	@Test
	void theDetailOffersRepublishingOnlyToWhoRetiredIt() throws Exception {
		Long team = teamAccount("equipo-hu307-volver@ejemplo.com");
		resourceService.retireResource(resourceId, team);
		String path = "/api/resources/" + resourceId;

		mockMvc.perform(get(path).with(signedInAs(team)))
				.andExpect(jsonPath("$.canRepublish").value(true))
				.andExpect(jsonPath("$.title").value(TITLE));
		mockMvc.perform(get(path).with(signedInAs(AUTHOR_ID)))
				.andExpect(jsonPath("$.canRepublish").value(false))
				.andExpect(jsonPath("$.title").value(nullValue()));
		mockMvc.perform(get(path)).andExpect(jsonPath("$.canRepublish").value(false));
	}

}
