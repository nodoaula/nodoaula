package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pruebas de HU308: un curso o un tema que solo se diferencian en mayúsculas,
 * tildes o espacios se consideran el mismo, y no se crea un duplicado.
 */
@SpringBootTest
@Transactional
class CourseAndTopicUniquenessTests {

	private static final Long AUTHOR_ID = 999L;

	@Autowired private ResourceService resourceService;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private CourseRepository courseRepository;
	@Autowired private TopicRepository topicRepository;

	private static CreateResourceRequest request(String course, List<String> topics, String urlSuffix) {
		return new CreateResourceRequest(
				"Recurso de la prueba de unicidad " + urlSuffix,
				"Descripcion de la prueba de unicidad.",
				LocalDate.of(2026, 10, 1),
				600,
				"Canal de la prueba",
				"https://www.youtube.com/watch?v=" + urlSuffix,
				ResourceType.VIDEO,
				course,
				topics);
	}

	@Test
	void aCourseThatDiffersOnlyInCaseOrAccentsReusesTheExistingOne() {
		ResourceDto first = resourceService.createResource(
				request("Programación Unicidad", List.of("Tema unicidad"), "unicidad-curso-1"), AUTHOR_ID);
		ResourceDto second = resourceService.createResource(
				request("  PROGRAMACION   unicidad ", List.of("Tema unicidad"), "unicidad-curso-2"), AUTHOR_ID);

		Course firstCourse = resourceRepository.findById(first.id()).orElseThrow().getCourse();
		Course secondCourse = resourceRepository.findById(second.id()).orElseThrow().getCourse();

		assertEquals(firstCourse.getId(), secondCourse.getId());
		assertEquals("Programación Unicidad", secondCourse.getName());
		assertEquals(1, courseRepository.findAll().stream()
				.filter(course -> NameNormalizer.normalize(course.getName()).equals("programacion unicidad"))
				.count());
	}

	@Test
	void aTopicThatDiffersOnlyInCaseOrAccentsReusesTheExistingOne() {
		ResourceDto first = resourceService.createResource(
				request("Curso de temas unicidad", List.of("Árboles binarios"), "unicidad-tema-1"), AUTHOR_ID);
		resourceService.createResource(
				request("Curso de temas unicidad", List.of("arboles BINARIOS"), "unicidad-tema-2"), AUTHOR_ID);

		Course course = resourceRepository.findById(first.id()).orElseThrow().getCourse();

		assertEquals(1, topicRepository.findAll().stream()
				.filter(topic -> topic.getCourse().getId().equals(course.getId()))
				.count());
	}

	@Test
	void theSameTopicNameInDifferentCoursesIsNotAConflict() {
		resourceService.createResource(
				request("Curso uno unicidad", List.of("Tema compartido"), "unicidad-cursos-1"), AUTHOR_ID);
		resourceService.createResource(
				request("Curso dos unicidad", List.of("Tema compartido"), "unicidad-cursos-2"), AUTHOR_ID);

		assertEquals(2, topicRepository.findAll().stream()
				.filter(topic -> topic.getName().equals("Tema compartido"))
				.count());
	}

}
