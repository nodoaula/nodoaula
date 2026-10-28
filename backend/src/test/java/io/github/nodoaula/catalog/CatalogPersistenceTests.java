package io.github.nodoaula.catalog;

import static io.github.nodoaula.catalog.RetirementTestSupport.AUTHOR_ID;
import static io.github.nodoaula.catalog.RetirementTestSupport.registerVideo;
import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Corregir, retirar y volver a publicar un recurso quedan guardados. Ninguna
 * de las tres llama a save(): guarda la transacción del servicio. Va sin la
 * transacción de la prueba a propósito, porque con ella un servicio sin
 * {@code @Transactional} pasaría las demás pruebas sin guardar nada. Por eso
 * borra lo que crea, antes y después, por si una corrida se cortó a medias.
 */
@SpringBootTest
class CatalogPersistenceTests {

	private static final String COURSE = "Curso de la prueba de persistencia";
	private static final String CORRECTED_COURSE = "Curso corregido de la prueba de persistencia";
	private static final String VIDEO_ID = "persistenc1";

	@Autowired private ResourceService resourceService;
	@Autowired private JdbcTemplate jdbcTemplate;

	private Long resourceId;

	@BeforeEach
	void registerAVideo() {
		deleteTestRows();
		resourceId = registerVideo(resourceService, "Video de la prueba de persistencia", VIDEO_ID, COURSE,
				List.of("Tema de la prueba"));
	}

	// El recurso se busca por su video, que es único; sus filas de
	// resource_topics se borran con él (on delete cascade).
	@AfterEach
	void deleteTestRows() {
		jdbcTemplate.update("delete from resources where video_id = ?", VIDEO_ID);
		for (String course : List.of(COURSE, CORRECTED_COURSE)) {
			jdbcTemplate.update("delete from topics where course_id in (select id from courses where name = ?)",
					course);
			jdbcTemplate.update("delete from courses where name = ?", course);
		}
	}

	private Map<String, Object> savedResource() {
		return jdbcTemplate.queryForMap("""
				select r.title, r.description, r.published_at, r.duration_seconds, r.channel, c.name as course,
				       r.retired_at, r.retired_by
				from resources r join courses c on c.id = r.course_id
				where r.id = ?""", resourceId);
	}

	@Test
	void correctingAResourceIsSaved() {
		resourceService.updateResource(resourceId, new UpdateResourceRequest("Título corregido",
				"Descripción corregida", LocalDate.of(2026, 9, 30), 1200, "Canal corregido", CORRECTED_COURSE,
				List.of("Tema corregido")), AUTHOR_ID);

		assertThat(savedResource())
				.containsEntry("title", "Título corregido")
				.containsEntry("description", "Descripción corregida")
				.containsEntry("published_at", Date.valueOf(LocalDate.of(2026, 9, 30)))
				.containsEntry("duration_seconds", 1200)
				.containsEntry("channel", "Canal corregido")
				.containsEntry("course", CORRECTED_COURSE);
		assertThat(jdbcTemplate.queryForList("""
				select t.name from resource_topics rt join topics t on t.id = rt.topic_id
				where rt.resource_id = ?""", String.class, resourceId)).containsExactly("Tema corregido");
	}

	@Test
	void retiringAResourceIsSavedWithWhoRetiredIt() {
		resourceService.retireResource(resourceId, AUTHOR_ID);

		Map<String, Object> resource = savedResource();
		assertThat(resource).containsEntry("retired_by", AUTHOR_ID);
		assertThat(resource.get("retired_at")).isNotNull();
	}

	@Test
	void republishingAResourceIsSaved() {
		// Retirado directamente en la base: esta prueba no depende de la del retiro.
		jdbcTemplate.update("update resources set retired_at = now(), retired_by = ? where id = ?", AUTHOR_ID,
				resourceId);

		resourceService.republishResource(resourceId, AUTHOR_ID);

		assertThat(savedResource()).containsEntry("retired_at", null).containsEntry("retired_by", null);
	}

}
