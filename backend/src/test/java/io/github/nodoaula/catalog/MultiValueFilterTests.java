package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pruebas de HU206 (filtrar por tema y por tipo de recurso, ademas de por
 * curso): los tres filtros (curso, tema, tipo) admiten uno o varios valores
 * a la vez, combinados entre si con OR, y los tres filtros se combinan
 * entre ellos con AND; marcar ambos tipos de recurso equivale a no filtrar
 * por tipo; y el selector de temas depende de los cursos elegidos.
 */
@SpringBootTest
@Transactional
class MultiValueFilterTests {

	private static final Long AUTHOR_ID = 999L;

	@Autowired private ResourceService resourceService;

	private static CreateResourceRequest request(
			String course, List<String> topics, ResourceType type, String urlSuffix) {
		return new CreateResourceRequest(
				"Recurso de la prueba multivalor " + urlSuffix,
				"Descripcion de la prueba multivalor.",
				LocalDate.of(2026, 10, 1),
				600,
				"Canal de la prueba",
				"https://www.youtube.com/watch?v=" + urlSuffix,
				type,
				course,
				topics);
	}

	@Test
	void courseFilterWithSeveralValuesCombinesThemWithOr() {
		ResourceDto a = resourceService.createResource(
				request("Curso A multivalor", List.of("Tema A"), ResourceType.VIDEO, "multivalor-curso-a"),
				AUTHOR_ID);
		ResourceDto b = resourceService.createResource(
				request("Curso B multivalor", List.of("Tema B"), ResourceType.VIDEO, "multivalor-curso-b"),
				AUTHOR_ID);
		resourceService.createResource(
				request("Curso C multivalor", List.of("Tema C"), ResourceType.VIDEO, "multivalor-curso-c"),
				AUTHOR_ID);

		Long courseAId = courseIdOf(a);
		Long courseBId = courseIdOf(b);

		List<ResourceDto> results = resourceService.listResources(
				List.of(courseAId, courseBId), null, null, null);

		Set<String> titles = results.stream().map(ResourceDto::title).collect(Collectors.toSet());
		assertTrue(titles.contains(a.title()));
		assertTrue(titles.contains(b.title()));
		assertTrue(results.stream().noneMatch(r -> r.course().equals("Curso C multivalor")));
	}

	@Test
	void topicFilterWithSeveralValuesCombinesThemWithOr() {
		ResourceDto withTopicX = resourceService.createResource(
				request("Curso del tema", List.of("Tema X multivalor"), ResourceType.VIDEO, "multivalor-tema-x"),
				AUTHOR_ID);
		ResourceDto withTopicY = resourceService.createResource(
				request("Curso del tema", List.of("Tema Y multivalor"), ResourceType.VIDEO, "multivalor-tema-y"),
				AUTHOR_ID);
		resourceService.createResource(
				request("Curso del tema", List.of("Tema Z multivalor"), ResourceType.VIDEO, "multivalor-tema-z"),
				AUTHOR_ID);

		List<TopicDto> topics = resourceService.listTopicsWithResources(null);
		Long topicXId = topicIdByName(topics, "Tema X multivalor");
		Long topicYId = topicIdByName(topics, "Tema Y multivalor");

		List<ResourceDto> results = resourceService.listResources(
				null, List.of(topicXId, topicYId), null, null);

		Set<String> titles = results.stream().map(ResourceDto::title).collect(Collectors.toSet());
		assertTrue(titles.contains(withTopicX.title()));
		assertTrue(titles.contains(withTopicY.title()));
		assertTrue(results.stream().noneMatch(r -> r.title().contains("multivalor-tema-z")));
	}

	@Test
	void selectingBothResourceTypesIsEquivalentToNotFilteringByType() {
		resourceService.createResource(
				request("Curso de tipos", List.of("Tema de tipos"), ResourceType.VIDEO, "multivalor-tipo-video"),
				AUTHOR_ID);
		resourceService.createResource(
				request("Curso de tipos", List.of("Tema de tipos"), ResourceType.DOCUMENT, "multivalor-tipo-doc"),
				AUTHOR_ID);

		List<ResourceDto> onlyVideo = resourceService.listResources(
				null, null, List.of(ResourceType.VIDEO), "multivalor-tipo-");
		List<ResourceDto> bothTypes = resourceService.listResources(
				null, null, List.of(ResourceType.VIDEO, ResourceType.DOCUMENT), "multivalor-tipo-");

		assertEquals(1, onlyVideo.size());
		assertEquals(ResourceType.VIDEO, onlyVideo.get(0).resourceType());
		assertEquals(2, bothTypes.size());
	}

	@Test
	void theThreeFiltersCombineWithAndAcrossEachOther() {
		ResourceDto matches = resourceService.createResource(
				request("Curso AND", List.of("Tema AND"), ResourceType.VIDEO, "multivalor-and-ok"), AUTHOR_ID);
		// Mismo curso y tema, pero tipo distinto: no debe aparecer al filtrar por VIDEO.
		resourceService.createResource(
				request("Curso AND", List.of("Tema AND"), ResourceType.DOCUMENT, "multivalor-and-tipo"), AUTHOR_ID);
		// Mismo curso, tema distinto: no debe aparecer al filtrar por el tema.
		resourceService.createResource(
				request("Curso AND", List.of("Otro tema AND"), ResourceType.VIDEO, "multivalor-and-tema"),
				AUTHOR_ID);

		Long courseId = courseIdOf(matches);
		Long topicId = topicIdByName(resourceService.listTopicsWithResources(List.of(courseId)), "Tema AND");

		List<ResourceDto> results = resourceService.listResources(
				List.of(courseId), List.of(topicId), List.of(ResourceType.VIDEO), null);

		assertEquals(1, results.size());
		assertEquals(matches.title(), results.get(0).title());
	}

	@Test
	void combinationWithNoMatchingResourcesReturnsAnEmptyListNotAnError() {
		resourceService.createResource(
				request("Curso sin coincidencia", List.of("Tema sin coincidencia"), ResourceType.VIDEO,
						"multivalor-sin-match"),
				AUTHOR_ID);

		List<ResourceDto> results = resourceService.listResources(
				null, null, List.of(ResourceType.DOCUMENT), "multivalor-sin-match");

		assertTrue(results.isEmpty());
	}

	@Test
	void topicSelectorWithoutACourseListsTopicsFromAllCoursesAndWithOneRestrictsToIt() {
		ResourceDto resourceA = resourceService.createResource(
				request("Curso del selector A", List.of("Tema del selector A"), ResourceType.VIDEO,
						"multivalor-selector-a"),
				AUTHOR_ID);
		resourceService.createResource(
				request("Curso del selector B", List.of("Tema del selector B"), ResourceType.VIDEO,
						"multivalor-selector-b"),
				AUTHOR_ID);

		List<TopicDto> allTopics = resourceService.listTopicsWithResources(null);
		assertTrue(allTopics.stream().anyMatch(t -> t.name().equals("Tema del selector A")));
		assertTrue(allTopics.stream().anyMatch(t -> t.name().equals("Tema del selector B")));

		Long courseAId = courseIdOf(resourceA);
		List<TopicDto> topicsOfCourseA = resourceService.listTopicsWithResources(List.of(courseAId));
		assertTrue(topicsOfCourseA.stream().anyMatch(t -> t.name().equals("Tema del selector A")));
		assertTrue(topicsOfCourseA.stream().noneMatch(t -> t.name().equals("Tema del selector B")));
	}

	private Long courseIdOf(ResourceDto resource) {
		return resourceService.listCoursesWithResources().stream()
				.filter(course -> course.name().equals(resource.course()))
				.map(CourseDto::id)
				.findFirst()
				.orElseThrow();
	}

	private static Long topicIdByName(List<TopicDto> topics, String name) {
		return topics.stream()
				.filter(topic -> topic.name().equals(name))
				.map(TopicDto::id)
				.findFirst()
				.orElseThrow();
	}

}
