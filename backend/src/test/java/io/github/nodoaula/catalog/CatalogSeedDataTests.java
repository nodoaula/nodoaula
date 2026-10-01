package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifica que el catálogo semilla cargado por Flyway (historia HU106,
 * AB#30/AB#85) sigue cumpliendo sus criterios de aceptación: cinco recursos
 * reales de al menos dos asignaturas distintas, cada uno con curso y al
 * menos un tema. No crea datos propios: solo lee lo que la migración
 * V202609202323__catalogo_semilla.sql dejó en la base.
 *
 * @Transactional mantiene abierta la sesión de Hibernate mientras se leen
 * curso y temas de cada recurso (son relaciones perezosas): sin ella,
 * acceder a resource.getCourse().getId() fuera de la transacción de
 * creación falla con LazyInitializationException. No hace falta deshacer
 * nada al terminar porque la prueba no escribe.
 *
 * Si cambia esta migración (por ejemplo, se agregan o reemplazan recursos),
 * esta prueba es la que avisa que hay que revisarla también aquí.
 */
@SpringBootTest
@Transactional
class CatalogSeedDataTests {

	// Las cinco URLs reales que carga la migración de catálogo semilla.
	private static final List<String> SEED_URLS = List.of(
			"https://www.youtube.com/watch?v=yhUh4ZmM45w",
			"https://www.youtube.com/watch?v=S0TC_HDfKvA",
			"https://www.youtube.com/watch?v=yrir47Z__lY",
			"https://www.youtube.com/watch?v=Djy28T8gxYs",
			"https://www.youtube.com/watch?v=FWQi5MJ1erQ");

	@Autowired
	private ResourceRepository resourceRepository;

	@Test
	void seedHasAtLeastFiveResourcesFromAtLeastTwoCoursesEachWithCourseAndATopic() {
		List<Resource> seedResources = resourceRepository.findAll().stream()
				.filter(resource -> SEED_URLS.contains(resource.getUrl()))
				.toList();

		assertEquals(5, seedResources.size());

		Set<Long> courseIds = seedResources.stream()
				.map(resource -> resource.getCourse().getId())
				.collect(Collectors.toSet());
		assertTrue(courseIds.size() >= 2, "El catalogo semilla debe cubrir al menos dos asignaturas distintas.");

		for (Resource resource : seedResources) {
			assertTrue(resource.getCourse() != null, "Cada recurso semilla debe tener curso asignado.");
			assertTrue(!resource.getTopics().isEmpty(), "Cada recurso semilla debe tener al menos un tema.");
		}
	}

}
