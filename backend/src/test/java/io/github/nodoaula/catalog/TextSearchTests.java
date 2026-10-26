package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
 *
 * La base puede tener otros recursos que coincidan con las busquedas (el
 * catalogo semilla o lo que se haya aportado), asi que las pruebas comprueban
 * por id que aparecen los recursos que crean y no los que no coinciden, en
 * vez de contar los resultados.
 */
@SpringBootTest
@Transactional
class TextSearchTests {

	private static final Long AUTHOR_ID = 999L;

	@Autowired private ResourceService resourceService;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private CourseRepository courseRepository;
	@Autowired private TopicRepository topicRepository;

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
		ResourceDto unrelated = resourceService.createResource(
				request("Recurso sin relacion", "Descripcion sin relacion", List.of("Tema sin relacion"),
						"busqueda-sin-relacion"),
				AUTHOR_ID);

		List<Long> ids = idsOf(resourceService.listResources(null, null, null, "bucles anidados"));

		assertTrue(ids.contains(byTitle.id()), "coincide por titulo");
		assertTrue(ids.contains(byDescription.id()), "coincide por descripcion");
		assertTrue(ids.contains(byTopic.id()), "coincide por tema");
		assertFalse(ids.contains(unrelated.id()), "no coincide en nada");
	}

	@Test
	void searchIsCaseAndAccentInsensitive() {
		ResourceDto resource = resourceService.createResource(
				request("Programación orientada a objetos", "Introducción con ejemplos", List.of("Tema generico"),
						"busqueda-tildes"),
				AUTHOR_ID);

		List<Long> withAccentsAndUppercase = idsOf(resourceService.listResources(
				null, null, null, "PROGRAMACIÓN ORIENTADA"));
		List<Long> withoutAccentsLowercase = idsOf(resourceService.listResources(
				null, null, null, "programacion orientada"));

		assertTrue(withAccentsAndUppercase.contains(resource.id()));
		assertTrue(withoutAccentsLowercase.contains(resource.id()));
		// Las dos formas de escribirlo son la misma busqueda, haya lo que haya en la base.
		assertEquals(withAccentsAndUppercase, withoutAccentsLowercase);
	}

	@Test
	void searchCombinesWithTheOtherFiltersUsingAnd() {
		ResourceDto matches = resourceService.createResource(
				request("Arboles binarios de busqueda", "Descripcion", List.of("Tema de arboles"),
						"busqueda-and-ok"),
				AUTHOR_ID);
		// Mismo texto, pero tipo distinto: no debe aparecer al filtrar por VIDEO.
		Long document = saveDocument(
				"Arboles binarios de busqueda (documento)", "Curso de la busqueda de texto", "Tema de arboles");

		List<ResourceDto> results = resourceService.listResources(
				null, null, List.of(ResourceType.VIDEO), "arboles binarios");

		List<Long> ids = idsOf(results);
		assertTrue(ids.contains(matches.id()));
		assertFalse(ids.contains(document));
		assertTrue(results.stream().allMatch(result -> result.resourceType() == ResourceType.VIDEO));
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

	// Un apunte no se registra por enlace: se guarda con su archivo, en el
	// curso y el tema que ya creó el video de la misma prueba.
	private Long saveDocument(String title, String courseName, String topicName) {
		Course course = courseRepository.findByName(courseName).orElseThrow();
		Resource document = Resource.document(title, null, LocalDate.of(2026, 10, 1), course, AUTHOR_ID,
				new DocumentFile(title + ".pdf", 2048, 3));
		document.addTopic(topicRepository.findByCourseAndName(course, topicName).orElseThrow());
		return resourceRepository.save(document).getId();
	}

	private static List<Long> idsOf(List<ResourceDto> resources) {
		return resources.stream().map(ResourceDto::id).toList();
	}

}
