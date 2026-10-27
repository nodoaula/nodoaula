package io.github.nodoaula.catalog;

import static io.github.nodoaula.catalog.RetirementTestSupport.seedResourceId;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.shared.storage.FileStorage;
import io.github.nodoaula.shared.storage.TransferQuota;

/**
 * Cubre el enlace a la vista previa de un apunte (historia HU412): se entrega
 * sin sesión, no de un recurso retirado ni de uno sin vista previa, y se cuenta
 * para el tope de transferencia antes de firmarlo. Como en el enlace al
 * archivo, el almacenamiento y el contador se sustituyen.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DocumentPreviewLinkTests {

	private static final Long AUTHOR_ID = 999L;
	private static final DocumentPreview PREVIEW = new DocumentPreview("enlace-apunte-vista-previa.pdf", 512, 3);
	private static final URI SIGNED_URL = URI.create(
			"https://proyecto.supabase.co/storage/v1/object/sign/notes/enlace-apunte-vista-previa.pdf?token=firma");

	@Autowired private MockMvc mockMvc;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private CourseRepository courseRepository;

	@MockitoBean private FileStorage fileStorage;
	@MockitoBean private TransferQuota transferQuota;

	private Course course;

	@BeforeEach
	void createCourse() {
		course = courseRepository.save(new Course("Curso de la prueba de la vista previa"));
	}

	@Test
	void withoutASessionItCountsThePreviewAndReturnsALinkValidForOneMinute() throws Exception {
		Long id = saveDocument(PREVIEW).getId();
		when(transferQuota.reserve(PREVIEW.sizeBytes())).thenReturn(true);
		when(fileStorage.signedUrl(PREVIEW.key(), Duration.ofSeconds(60))).thenReturn(SIGNED_URL);

		mockMvc.perform(post("/api/resources/{id}/preview-link", id).with(csrf()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.url").value(SIGNED_URL.toString()));

		verify(transferQuota).reserve(PREVIEW.sizeBytes());
	}

	@Test
	void withoutTheCsrfTokenNothingIsCountedNorSigned() throws Exception {
		Long id = saveDocument(PREVIEW).getId();

		mockMvc.perform(post("/api/resources/{id}/preview-link", id)).andExpect(status().isForbidden());

		verifyNoInteractions(transferQuota, fileStorage);
	}

	@Test
	void aRetiredDocumentHasNoPreviewLink() throws Exception {
		Resource document = saveDocument(PREVIEW);
		document.retire(AUTHOR_ID, Instant.now());
		resourceRepository.saveAndFlush(document);

		expectError(document.getId(), 409, "RESOURCE_RETIRED");
	}

	@Test
	void aDocumentWithoutAPreviewHasNoPreviewLink() throws Exception {
		expectError(saveDocument(null).getId(), 404, "DOCUMENT_PREVIEW_NOT_FOUND");
	}

	@Test
	void aVideoHasNoPreview() throws Exception {
		expectError(seedResourceId(resourceRepository), 404, "DOCUMENT_PREVIEW_NOT_FOUND");
	}

	@Test
	void aResourceThatDoesNotExistHasNoPreviewLink() throws Exception {
		expectError(Long.MAX_VALUE, 404, "RESOURCE_NOT_FOUND");
	}

	@Test
	void whenTheTransferIsExhaustedNothingIsSigned() throws Exception {
		Long id = saveDocument(PREVIEW).getId();
		when(transferQuota.reserve(anyLong())).thenReturn(false);

		mockMvc.perform(post("/api/resources/{id}/preview-link", id).with(csrf()))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("DOCUMENT_TRANSFER_EXHAUSTED"));

		verify(fileStorage, never()).signedUrl(any(), any());
	}

	private Resource saveDocument(DocumentPreview preview) {
		Resource document = Resource.document("Apunte de la prueba de la vista previa", null,
				LocalDate.of(2026, 10, 20), course, AUTHOR_ID, new DocumentFile("enlace-apunte.pdf", 2048, 10));
		if (preview != null) {
			document.attachPreview(preview);
		}
		return resourceRepository.saveAndFlush(document);
	}

	private void expectError(Long id, int status, String code) throws Exception {
		mockMvc.perform(post("/api/resources/{id}/preview-link", id).with(csrf()))
				.andExpect(status().is(status))
				.andExpect(jsonPath("$.code").value(code));

		verifyNoInteractions(transferQuota, fileStorage);
	}

}
