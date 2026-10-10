package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.jayway.jsonpath.JsonPath;

import io.github.nodoaula.catalog.ResourceEntryMethodTests.TestAuthor;
import io.github.nodoaula.shared.storage.FileStorage;
import io.github.nodoaula.shared.storage.StorageUnavailableException;

/**
 * Cubre la subida de un apunte (historia HU302): la sesión, la validación del
 * PDF y del formulario, el nombre que genera el servidor, lo que se guarda,
 * la compensación si falla el registro y el tope del almacenamiento.
 *
 * El almacenamiento real nunca se llama: se sustituye esa frontera,
 * FileStorage, igual que VideoMetadataProvider en las pruebas de YouTube.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DocumentUploadTests {

	private static final Long AUTHOR_ID = 999L;
	private static final String TITLE = "Apunte de la prueba de subida";
	private static final String COURSE = "Curso de la prueba de subida";
	private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");

	@Autowired private MockMvc mockMvc;
	@Autowired private ResourceService resourceService;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private CourseRepository courseRepository;

	@MockitoBean private FileStorage fileStorage;
	@MockitoSpyBean private TransactionTemplate transactionTemplate;

	@Test
	void uploadsAValidPdfUnderAGeneratedNameAndRegistersIt() throws Exception {
		byte[] pdf = pdf(3);
		AtomicReference<Path> uploadedFrom = new AtomicReference<>();
		doAnswer(invocation -> {
			uploadedFrom.set(invocation.getArgument(1));
			return null;
		}).when(fileStorage).store(anyString(), any(), anyString());
		LocalDate before = LocalDate.now(BOGOTA);

		String body = mockMvc.perform(upload(file("mis notas.pdf", pdf)).param("description", "  Resumen  "))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.resourceType").value("DOCUMENT"))
				.andReturn().getResponse().getContentAsString();

		LocalDate after = LocalDate.now(BOGOTA);
		ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
		verify(fileStorage).store(key.capture(), any(), eq(MediaType.APPLICATION_PDF_VALUE));
		assertTrue(key.getValue().matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.pdf"));
		assertFalse(Files.exists(uploadedFrom.get()), "el temporal se borra al terminar");

		long id = JsonPath.<Number>read(body, "$.id").longValue();
		Resource saved = resourceRepository.findById(id).orElseThrow();
		assertEquals(new DocumentFile(key.getValue(), pdf.length, 3), saved.getFile());
		assertNull(saved.getUrl());
		assertEquals("Resumen", saved.getDescription());
		assertEquals(EntryMethod.MANUAL, saved.getEntryMethod());
		assertTrue(!saved.getPublishedAt().isBefore(before) && !saved.getPublishedAt().isAfter(after));
		assertEquals(2, saved.getTopics().size());
	}

	@Test
	void theUploadedDocumentIsListedInTheCatalogRightAway() throws Exception {
		mockMvc.perform(upload(file("apunte.pdf", pdf(1))))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/resources").param("q", TITLE))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].title").value(TITLE));
	}

	@Test
	void withoutASessionTheUploadIsRejected() throws Exception {
		mockMvc.perform(multipart("/api/resources/documents").file(file("apunte.pdf", pdf(1))).with(csrf()))
				.andExpect(status().isUnauthorized());

		verify(fileStorage, never()).store(anyString(), any(), anyString());
	}

	@Test
	void aFileThatIsNotAPdfIsRejectedEvenWithThePdfExtension() throws Exception {
		expectFileRejected(file("apunte.pdf", "no soy un pdf".getBytes(StandardCharsets.UTF_8)));
	}

	@Test
	void aPasswordProtectedPdfIsRejected() throws Exception {
		expectFileRejected(file("apunte.pdf", passwordProtectedPdf()));
	}

	@Test
	void aPdfWithoutPagesIsRejected() throws Exception {
		expectFileRejected(file("apunte.pdf", pdf(0)));
	}

	@Test
	void theFileIsRequired() throws Exception {
		mockMvc.perform(authenticated(multipart("/api/resources/documents"))
				.param("title", TITLE).param("course", COURSE).param("topics", "Tema A")
				.param("rightsDeclared", "true"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("file"));
	}

	@Test
	void theRightsDeclarationIsRequired() throws Exception {
		expectRightsDeclarationRejected(null);
		expectRightsDeclarationRejected("false");

		verify(fileStorage, never()).store(anyString(), any(), anyString());
	}

	@Test
	void ifTheStorageFailsNothingIsRegistered() throws Exception {
		doThrow(new StorageUnavailableException(null)).when(fileStorage).store(anyString(), any(), anyString());
		long before = resourceRepository.count();

		mockMvc.perform(upload(file("apunte.pdf", pdf(1))))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("STORAGE_UNAVAILABLE"));

		assertEquals(before, resourceRepository.count());
	}

	@Test
	void ifTheRegistrationFailsTheStoredFileIsDeleted() throws IOException {
		doThrow(new DataIntegrityViolationException("registro simulado")).when(transactionTemplate).execute(any());
		DocumentUploadRequest request = new DocumentUploadRequest(file("apunte.pdf", pdf(1)), TITLE, null, COURSE,
				List.of("Tema A"), true);

		assertThrows(DataIntegrityViolationException.class, () -> resourceService.createDocument(request, AUTHOR_ID));

		ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
		verify(fileStorage).store(key.capture(), any(), anyString());
		verify(fileStorage).delete(key.getValue());
	}

	@Test
	void anUploadThatWouldPassTheStorageLimitIsRejected() throws Exception {
		Course course = courseRepository.save(new Course(COURSE));
		resourceRepository.save(Resource.document("Apunte que llena el almacenamiento", null, LocalDate.now(BOGOTA),
				course, AUTHOR_ID, new DocumentFile("lleno.pdf", ResourceService.STORAGE_LIMIT_BYTES, 1)));

		mockMvc.perform(upload(file("apunte.pdf", pdf(1))))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("DOCUMENT_STORAGE_FULL"));

		verify(fileStorage, never()).store(anyString(), any(), anyString());
	}

	@Test
	void theLinkRegistrationRejectsADocument() throws Exception {
		String body = """
				{
				  "title": "Apunte por enlace",
				  "publishedAt": "2026-10-01",
				  "url": "https://ejemplo.com/apunte.pdf",
				  "resourceType": "DOCUMENT",
				  "course": "%s",
				  "topics": ["Tema A"]
				}
				""".formatted(COURSE);

		mockMvc.perform(post("/api/resources")
				.with(authentication(new UsernamePasswordAuthenticationToken(new TestAuthor(AUTHOR_ID), null, List.of())))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("resourceType"));
	}

	private void expectRightsDeclarationRejected(String value) throws Exception {
		MockMultipartHttpServletRequestBuilder request = multipart("/api/resources/documents")
				.file(file("apunte.pdf", pdf(1)));
		request.param("title", TITLE).param("course", COURSE).param("topics", "Tema A");
		if (value != null) {
			request.param("rightsDeclared", value);
		}

		mockMvc.perform(authenticated(request))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("rightsDeclared"))
				.andExpect(jsonPath("$.errors[0].message").value(DocumentUploadRequest.RIGHTS_MESSAGE));
	}

	private void expectFileRejected(MockMultipartFile file) throws Exception {
		long before = resourceRepository.count();

		mockMvc.perform(upload(file))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[0].field").value("file"));

		verify(fileStorage, never()).store(anyString(), any(), anyString());
		assertEquals(before, resourceRepository.count());
	}

	private MockMultipartHttpServletRequestBuilder upload(MockMultipartFile file) {
		MockMultipartHttpServletRequestBuilder request = multipart("/api/resources/documents").file(file);
		request.param("title", TITLE).param("course", COURSE).param("topics", "Tema A", "Tema B")
				.param("rightsDeclared", "true");
		return authenticated(request);
	}

	private static MockMultipartHttpServletRequestBuilder authenticated(MockMultipartHttpServletRequestBuilder request) {
		request.with(authentication(new UsernamePasswordAuthenticationToken(new TestAuthor(AUTHOR_ID), null, List.of())))
				.with(csrf());
		return request;
	}

	private static MockMultipartFile file(String name, byte[] content) {
		return new MockMultipartFile("file", name, MediaType.APPLICATION_PDF_VALUE, content);
	}

	private static byte[] pdf(int pages) throws IOException {
		try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			for (int i = 0; i < pages; i++) {
				document.addPage(new PDPage());
			}
			document.save(out);
			return out.toByteArray();
		}
	}

	private static byte[] passwordProtectedPdf() throws IOException {
		try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			document.addPage(new PDPage());
			document.protect(new StandardProtectionPolicy("propietario", "abrir", new AccessPermission()));
			document.save(out);
			return out.toByteArray();
		}
	}

}
