package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Prueba de AB#213: dos registros simultáneos que crean el mismo curso o el
 * mismo tema nuevo terminan los dos bien y con un solo curso y un solo tema,
 * en lugar de que el segundo reciba un error 500.
 *
 * No es @Transactional: cada hilo necesita su propia transacción confirmada
 * para que haya una carrera real, así que la prueba borra lo que crea.
 */
@SpringBootTest
class ConcurrentCatalogCreationTests {

	private static final Long AUTHOR_ID = 999L;
	private static final int ROUNDS = 5;

	@Autowired private ResourceService resourceService;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private CourseRepository courseRepository;
	@Autowired private TopicRepository topicRepository;

	private final List<Long> createdResourceIds = new ArrayList<>();
	private final List<String> createdCourseNames = new ArrayList<>();

	@AfterEach
	void cleanUp() {
		createdResourceIds.forEach(resourceRepository::deleteById);
		for (String courseName : createdCourseNames) {
			courseRepository.findByName(courseName).ifPresent(course -> {
				topicRepository.findByCourseAndNormalizedName(course, NameNormalizer.normalize(topicNameOf(courseName)))
						.ifPresent(topicRepository::delete);
				courseRepository.delete(course);
			});
		}
	}

	// El tema de cada ronda se deriva del nombre del curso para poder borrarlo.
	private static String topicNameOf(String courseName) {
		return courseName.replace("Curso", "Tema");
	}

	private static CreateResourceRequest request(String course, String topic, String urlSuffix) {
		return new CreateResourceRequest(
				"Recurso de la prueba concurrente " + urlSuffix,
				"Descripcion de la prueba concurrente.",
				LocalDate.of(2026, 10, 1),
				600,
				"Canal de la prueba",
				"https://www.youtube.com/watch?v=" + urlSuffix,
				ResourceType.VIDEO,
				course,
				List.of(topic));
	}

	@Test
	void twoSimultaneousRegistrationsOfTheSameNewCourseAndTopicBothSucceedWithOneOfEach() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int round = 0; round < ROUNDS; round++) {
				String courseName = "Curso concurrente " + round;
				createdCourseNames.add(courseName);
				String topicName = topicNameOf(courseName);
				CountDownLatch start = new CountDownLatch(1);

				List<Future<ResourceDto>> results = new ArrayList<>();
				for (int thread = 0; thread < 2; thread++) {
					String urlSuffix = "concurrente-" + round + "-" + thread;
					results.add(executor.submit(() -> {
						start.await();
						return resourceService.createResource(request(courseName, topicName, urlSuffix), AUTHOR_ID);
					}));
				}
				start.countDown();

				for (Future<ResourceDto> result : results) {
					createdResourceIds.add(result.get(30, TimeUnit.SECONDS).id());
				}

				assertEquals(1, courseRepository.findAll().stream()
						.filter(course -> course.getName().equals(courseName))
						.count());
				Course course = courseRepository.findByName(courseName).orElseThrow();
				assertEquals(1, resourceService.listTopicsWithResources(List.of(course.getId())).size());
			}
		} finally {
			executor.shutdownNow();
		}
	}

}
