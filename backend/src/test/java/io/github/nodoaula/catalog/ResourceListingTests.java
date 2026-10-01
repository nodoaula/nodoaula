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
class ResourceListingTests {

	private static final String TITLE = "Recurso de la prueba del listado";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ResourceService resourceService;

	@Test
	void listingIncludesUrlAndTopicsSortedByName() throws Exception {
		resourceService.createResource(new CreateResourceRequest(
				TITLE,
				null,
				LocalDate.of(2026, 10, 1),
				null,
				null,
				"https://www.youtube.com/watch?v=gJrjgg1KVL4",
				ResourceType.VIDEO,
				"Curso de la prueba del listado",
				List.of("Zeta", "Alfa")), 0L);

		mockMvc.perform(get("/api/resources").param("q", TITLE))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].url").value("https://www.youtube.com/watch?v=gJrjgg1KVL4"))
				.andExpect(jsonPath("$[0].topics[0]").value("Alfa"))
				.andExpect(jsonPath("$[0].topics[1]").value("Zeta"));
	}

}
