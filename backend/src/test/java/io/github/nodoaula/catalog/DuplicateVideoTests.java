package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pruebas de HU308: el mismo video de YouTube no se registra dos veces, se
 * pegue como se pegue el enlace, y el intento rechazado no crea nada.
 */
@SpringBootTest
@Transactional
class DuplicateVideoTests {

	private static final Long AUTHOR_ID = 999L;
	private static final String VIDEO_ID = "dQw4w9WgXcQ";

	@Autowired private ResourceService resourceService;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private CourseRepository courseRepository;

	private static CreateResourceRequest request(String url, String course) {
		return new CreateResourceRequest(
				"Video de la prueba de duplicados",
				"Descripcion de la prueba de duplicados.",
				LocalDate.of(2026, 10, 1),
				600,
				"Canal de la prueba",
				url,
				ResourceType.VIDEO,
				course,
				List.of("Tema duplicados"));
	}

	@Test
	void theSameVideoInAnotherLinkFormIsRejected() {
		resourceService.createResource(
				request("https://www.youtube.com/watch?v=" + VIDEO_ID, "Curso duplicados"), AUTHOR_ID);

		for (String link : List.of(
				"https://youtu.be/" + VIDEO_ID,
				"https://youtu.be/" + VIDEO_ID + "?t=42",
				"https://www.youtube.com/watch?feature=share&v=" + VIDEO_ID + "&t=10s",
				"https://m.youtube.com/watch?v=" + VIDEO_ID,
				"https://www.youtube.com/embed/" + VIDEO_ID)) {
			VideoAlreadyRegisteredException exception = assertThrows(VideoAlreadyRegisteredException.class,
					() -> resourceService.createResource(request(link, "Curso duplicados"), AUTHOR_ID), link);
			assertEquals("VIDEO_ALREADY_REGISTERED", exception.getCode());
		}
	}

	@Test
	void aRejectedDuplicateDoesNotCreateAnything() {
		resourceService.createResource(
				request("https://www.youtube.com/watch?v=" + VIDEO_ID, "Curso duplicados"), AUTHOR_ID);
		long resources = resourceRepository.count();
		long courses = courseRepository.count();

		assertThrows(VideoAlreadyRegisteredException.class, () -> resourceService.createResource(
				request("https://youtu.be/" + VIDEO_ID, "Otro curso que no debe crearse"), AUTHOR_ID));

		assertEquals(resources, resourceRepository.count());
		assertEquals(courses, courseRepository.count());
	}

	@Test
	void aDifferentVideoIsAccepted() {
		resourceService.createResource(
				request("https://www.youtube.com/watch?v=" + VIDEO_ID, "Curso duplicados"), AUTHOR_ID);
		resourceService.createResource(
				request("https://www.youtube.com/watch?v=abcdefghijk", "Curso duplicados"), AUTHOR_ID);

		assertEquals(2, resourceRepository.findAll().stream()
				.filter(resource -> resource.getUrl().contains(VIDEO_ID) || resource.getUrl().contains("abcdefghijk"))
				.count());
	}

}
