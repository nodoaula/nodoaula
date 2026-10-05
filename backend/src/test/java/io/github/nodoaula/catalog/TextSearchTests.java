package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pruebas de HU207 (buscar recursos por texto): la busqueda considera
 * titulo, descripcion y temas; es insensible a mayusculas y tildes; se
 * combina (AND) con los filtros de curso, tema y tipo (HU206); y sin
 * resultados responde una lista vacia, no un error.
 */
@SpringBootTest
@Transactional
class TextSearchTests {

	private static final Long AUTHOR_ID = 999L;

	@Autowired private ResourceService resourceService;

	private static CreateResourceRequest request(
			String title, String description, List<String> topics, String urlSuffix) {
		return new CreateResourceRequest(
				title,
				description,
				LocalDate.of(2026, 10, 1),
				600,
				"Canal de la prueba",
				"https://www.youtube.com/watch?v=" + urlSuffix,
				ResourceType.VIDEO,
				"Curso de la busqueda de texto",
				topics);
	}

	@Test
	void searchMatchesTitleDescriptionAndTopics() {
		ResourceDto byTitle = resourceService.createResource(
				request("Recurso sobre bucles anidados", "Descripcion generica", List.of("Tema generico"),
						"busqueda-titulo"),
				AUTHOR_ID);
		ResourceDto byDescription = resourceService.createResource(
				request("Recurso generico", "Explica los bucles anidados en detalle", List.of("Tema generico"),
						"busqueda-descripcion"),
				AUTHOR_ID);
		ResourceDto byTopic = resourceService.createResource(
				request("Recurso generico", "Descripcion generica", List.of("Bucles anidados"), "busqueda-tema"),
				AUTHOR_ID);
		resourceService.createResource(
				request("Recurso sin relacion", "Descripcion sin relacion", List.of("Tema sin relacion"),
						"busqueda-sin-relacion"),
				AUTHOR_ID);

		List<ResourceDto> results = resourceService.listResources(null, null, null, "bucles anidados");

		List<String> titles = results.stream().map(ResourceDto::title).toList();
		assertTrue(titles.contains(byTitle.title()));
		assertTrue(titles.contains(byDescription.title()));
		assertTrue(titles.contains(byTopic.title()));
		assertEquals(3, results.size());
	}

	@Test
	void searchIsCaseAndAccentInsensitive() {
		ResourceDto resource = resourceService.createResource(
				request("Programación orientada a objetos", "Introducción con ejemplos", List.of("Tema generico"),
						"busqueda-tildes"),
				AUTHOR_ID);

		List<ResourceDto> withAccentsAndUppercase = resourceService.listResources(
				null, null, null, "PROGRAMACIÓN ORIENTADA");
		List<ResourceDto> withoutAccentsLowercase = resourceService.listResources(
				null, null, null, "programacion orientada");

		assertEquals(1, withAccentsAndUppercase.size());
		assertEquals(resource.title(), withAccentsAndUppercase.get(0).title());
		assertEquals(1, withoutAccentsLowercase.size());
		assertEquals(resource.title(), withoutAccentsLowercase.get(0).title());
	}

	@Test
	void searchCombinesWithTheOtherFiltersUsingAnd() {
		ResourceDto matches = resourceService.createResource(
				request("Arboles binarios de busqueda", "Descripcion", List.of("Tema de arboles"),
						"busqueda-and-ok"),
				AUTHOR_ID);
		// Mismo texto, pero tipo distinto: no debe aparecer al filtrar por VIDEO.
		CreateResourceRequest documentVersion = new CreateResourceRequest(
				"Arboles binarios de busqueda (documento)",
				"Descripcion",
				LocalDate.of(2026, 10, 1),
				600,
				"Canal de la prueba",
				"https://www.youtube.com/watch?v=busqueda-and-tipo",
				ResourceType.DOCUMENT,
				"Curso de la busqueda de texto",
				List.of("Tema de arboles"));
		resourceService.createResource(documentVersion, AUTHOR_ID);

		List<ResourceDto> results = resourceService.listResources(
				null, null, List.of(ResourceType.VIDEO), "arboles binarios");

		assertEquals(1, results.size());
		assertEquals(matches.title(), results.get(0).title());
	}

	@Test
	void searchWithNoMatchesReturnsAnEmptyListNotAnError() {
		resourceService.createResource(
				request("Recurso cualquiera", "Descripcion cualquiera", List.of("Tema cualquiera"),
						"busqueda-vacia"),
				AUTHOR_ID);

		List<ResourceDto> results = resourceService.listResources(
				null, null, null, "texto que no coincide con nada");

		assertTrue(results.isEmpty());
	}

}
