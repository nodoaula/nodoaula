package io.github.nodoaula.catalog;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pruebas de HU310: el catálogo se consulta sin cuenta, aportar exige sesión,
 * un recurso que no existe responde 404 con su código, y un conjunto de
 * búsquedas representativas devuelve lo esperado sobre el catálogo semilla.
 * Es la evidencia automatizada del objetivo OE5.
 */
@Tag("evidencia-OE5")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CatalogAccessTests {

	private static final String AZURE = "Azure DevOps desde la creación del proyecto hasta la gestión de backlog y Sprints 2026-2";
	private static final String HARNESS = "Harness Engineering JuanFQuintana 2026-2";
	private static final String SPRING = "Spring Boot 2026-2";
	private static final String GIT = "Git y GitHub 2026-2";
	private static final String TALLER = "Taller Integración y desarrollo Nivel Básico 2026-2";

	@Autowired
	private MockMvc mockMvc;

	@Test
	void theCatalogCanBeBrowsedWithoutASession() throws Exception {
		for (String path : new String[] { "/api/resources", "/api/resources/courses", "/api/resources/topics" }) {
			mockMvc.perform(get(path)).andExpect(status().isOk());
		}
		mockMvc.perform(get("/api/resources"))
				.andExpect(jsonPath("$[*].title").value(hasItem(SPRING)));
	}

	@Test
	void aSeedResourceDetailOpensWithoutASession() throws Exception {
		String json = mockMvc.perform(get("/api/resources").param("q", "spring boot"))
				.andReturn().getResponse().getContentAsString();
		String id = json.replaceAll("(?s).*?\"id\"\\s*:\\s*(\\d+).*", "$1");

		mockMvc.perform(get("/api/resources/" + id))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value(SPRING));
	}

	@Test
	void aResourceThatDoesNotExistIsA404WithItsCode() throws Exception {
		mockMvc.perform(get("/api/resources/999999999"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
	}

	@Test
	void contributingWithoutASessionIsA401() throws Exception {
		mockMvc.perform(post("/api/resources").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\":\"Sin sesión\"}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

		mockMvc.perform(multipart("/api/resources/documents").with(csrf()))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	@Test
	void queryingYouTubeWithoutASessionIsA401() throws Exception {
		mockMvc.perform(get("/api/resources/youtube-metadata")
				.param("url", "https://www.youtube.com/watch?v=yhUh4ZmM45w"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	// Cada fila es una búsqueda que haría una persona y los títulos que debe
	// devolver, separados por «|». Se ignoran mayúsculas y tildes.
	@ParameterizedTest(name = "«{0}» devuelve {1}")
	@CsvSource(delimiter = ';', value = {
			"spring;" + SPRING,
			"SPRING BOOT;" + SPRING,
			"git;" + GIT,
			"azure;" + AZURE,
			"backlog;" + AZURE,
			"harness;" + HARNESS,
			"control de versiones;" + GIT,
			"integracion;" + HARNESS + "|" + TALLER,
			"integración;" + HARNESS + "|" + TALLER,
			"despliegue continuo;" + HARNESS,
	})
	void representativeSearchesReturnTheExpectedResources(String query, String expectedTitles) throws Exception {
		mockMvc.perform(get("/api/resources").param("q", query))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[*].title").value(containsInAnyOrder(expectedTitles.split("\\|"))));
	}

	@Test
	void aSearchWithNoMatchesIsAnEmptyListNotAnError() throws Exception {
		mockMvc.perform(get("/api/resources").param("q", "xyzzy-no-existe"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));
	}

}
