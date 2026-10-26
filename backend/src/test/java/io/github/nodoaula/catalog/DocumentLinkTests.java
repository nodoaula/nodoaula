package io.github.nodoaula.catalog;

import static io.github.nodoaula.catalog.RetirementTestSupport.seedResourceId;
import static io.github.nodoaula.catalog.RetirementTestSupport.signedInAs;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.shared.storage.FileStorage;
import io.github.nodoaula.shared.storage.TransferQuota;

/**
 * Cubre el enlace al archivo de un apunte (historia HU411): exige sesión, no
 * se entrega de un recurso retirado ni de un video, y se cuenta para el tope
 * de transferencia antes de firmarlo. El almacenamiento y el contador se
 * sustituyen: sus propias pruebas los cubren contra Supabase y PostgreSQL.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DocumentLinkTests {

	private static final Long AUTHOR_ID = 999L;
	private static final Long READER_ID = 555L;
	private static final DocumentFile FILE = new DocumentFile("enlace-apunte.pdf", 2048, 3);
	private static final URI SIGNED_URL =
			URI.create("https://proyecto.supabase.co/storage/v1/object/sign/notes/enlace-apunte.pdf?token=firma");

	@Autowired private MockMvc mockMvc;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private CourseRepository courseRepository;

	@MockitoBean private FileStorage fileStorage;
	@MockitoBean private TransferQuota transferQuota;

	private Course course;

	@BeforeEach
	void createCourse() {
		course = courseRepository.save(new Course("Curso de la prueba del enlace"));
	}

	@Test
	void withASessionItCountsTheFileAndReturnsALinkValidForOneMinute() throws Exception {
		Long id = saveDocument().getId();
		when(transferQuota.reserve(FILE.sizeBytes())).thenReturn(true);
		when(fileStorage.signedUrl(FILE.key(), Duration.ofSeconds(60))).thenReturn(SIGNED_URL);

		mockMvc.perform(requestLink(id).with(signedInAs(READER_ID)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.url").value(SIGNED_URL.toString()));

		verify(transferQuota).reserve(FILE.sizeBytes());
	}

	@Test
	void withoutASessionNothingIsCountedNorSigned() throws Exception {
		Long id = saveDocument().getId();

		mockMvc.perform(requestLink(id)).andExpect(status().isUnauthorized());

		verifyNoInteractions(transferQuota, fileStorage);
	}

	@Test
	void aRetiredDocumentHasNoLink() throws Exception {
		Resource document = saveDocument();
		document.retire(AUTHOR_ID, Instant.now());
		resourceRepository.saveAndFlush(document);

		expectError(document.getId(), 409, "RESOURCE_RETIRED");
		verifyNoInteractions(transferQuota, fileStorage);
	}

	@Test
	void aVideoHasNoFile() throws Exception {
		expectError(seedResourceId(resourceRepository), 404, "DOCUMENT_FILE_NOT_FOUND");
		verifyNoInteractions(transferQuota, fileStorage);
	}

	@Test
	void aResourceThatDoesNotExistHasNoLink() throws Exception {
		expectError(Long.MAX_VALUE, 404, "RESOURCE_NOT_FOUND");
		verifyNoInteractions(transferQuota, fileStorage);
	}

	@Test
	void whenTheTransferIsExhaustedNothingIsSigned() throws Exception {
		Long id = saveDocument().getId();
		when(transferQuota.reserve(anyLong())).thenReturn(false);

		expectError(id, 503, "DOCUMENT_TRANSFER_EXHAUSTED");
		verify(fileStorage, never()).signedUrl(any(), any());
	}

	private Resource saveDocument() {
		return resourceRepository.saveAndFlush(Resource.document("Apunte de la prueba del enlace", null,
				LocalDate.of(2026, 10, 20), course, AUTHOR_ID, FILE));
	}

	private void expectError(Long id, int status, String code) throws Exception {
		mockMvc.perform(requestLink(id).with(signedInAs(READER_ID)))
				.andExpect(status().is(status))
				.andExpect(jsonPath("$.code").value(code));
	}

	private static MockHttpServletRequestBuilder requestLink(Long id) {
		return post("/api/resources/{id}/document-link", id).with(csrf());
	}

}
