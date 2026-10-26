package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;

/**
 * Cubre la restricción de HU302 en la base de datos: un video tiene enlace y
 * un apunte tiene archivo, y cualquier otra combinación se rechaza. También la
 * de HU412: solo un apunte tiene vista previa, y siempre con todos sus datos.
 */
@SpringBootTest
@Transactional
class ResourceLinkOrFileTests {

	private static final Long AUTHOR_ID = 999L;
	private static final LocalDate PUBLISHED_AT = LocalDate.of(2026, 10, 10);

	@Autowired private ResourceRepository resourceRepository;
	@Autowired private CourseRepository courseRepository;
	@Autowired private EntityManager entityManager;

	private Course course;

	@BeforeEach
	void createCourse() {
		course = courseRepository.save(new Course("Curso de la restricción de archivo"));
	}

	@Test
	void aDocumentIsSavedWithItsFile() {
		DocumentFile file = new DocumentFile("restriccion-apunte.pdf", 2048, 3);
		Long id = resourceRepository.saveAndFlush(
				Resource.document("Apunte", null, PUBLISHED_AT, course, AUTHOR_ID, file)).getId();
		entityManager.clear();

		Resource saved = resourceRepository.findById(id).orElseThrow();
		assertEquals(file, saved.getFile());
		assertNull(saved.getUrl());
	}

	@Test
	void aVideoIsSavedWithoutAFile() {
		Long id = resourceRepository.saveAndFlush(
				video("https://www.youtube.com/watch?v=restriccion-video")).getId();
		entityManager.clear();

		assertNull(resourceRepository.findById(id).orElseThrow().getFile());
	}

	@Test
	void aVideoWithoutALinkIsRejected() {
		Resource video = video(null);

		assertThrows(DataIntegrityViolationException.class, () -> resourceRepository.saveAndFlush(video));
	}

	@Test
	void aDocumentWithALinkIsRejected() {
		Resource document = new Resource("Apunte con enlace", null, PUBLISHED_AT, null, null,
				"https://ejemplo.com/apunte.pdf", ResourceType.DOCUMENT, course, AUTHOR_ID, EntryMethod.MANUAL);

		assertThrows(DataIntegrityViolationException.class, () -> resourceRepository.saveAndFlush(document));
	}

	@Test
	void aDocumentIsSavedWithItsPreview() {
		Resource document = Resource.document("Apunte con vista previa", null, PUBLISHED_AT, course, AUTHOR_ID,
				new DocumentFile("restriccion-vista.pdf", 2048, 10));
		DocumentPreview preview = new DocumentPreview("restriccion-vista-vista-previa.pdf", 512, 3);
		document.attachPreview(preview);
		Long id = resourceRepository.saveAndFlush(document).getId();
		entityManager.clear();

		assertEquals(preview, resourceRepository.findById(id).orElseThrow().getPreview());
	}

	@Test
	void aVideoWithAPreviewIsRejected() {
		Resource video = video("https://www.youtube.com/watch?v=restriccion-vista");
		video.attachPreview(new DocumentPreview("video-vista-previa.pdf", 512, 3));

		assertThrows(DataIntegrityViolationException.class, () -> resourceRepository.saveAndFlush(video));
	}

	@Test
	void aPreviewWithoutItsKeyIsRejected() {
		Resource document = Resource.document("Apunte con vista previa a medias", null, PUBLISHED_AT, course,
				AUTHOR_ID, new DocumentFile("restriccion-media.pdf", 2048, 10));
		document.attachPreview(new DocumentPreview(null, 512, 3));

		assertThrows(DataIntegrityViolationException.class, () -> resourceRepository.saveAndFlush(document));
	}

	private Resource video(String url) {
		return new Resource("Video", null, PUBLISHED_AT, 600, "Canal", url, ResourceType.VIDEO, course, AUTHOR_ID,
				EntryMethod.MANUAL);
	}

}
