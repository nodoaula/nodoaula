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
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.stubbing.Answer;
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
import io.github.nodoaula.shared.error.FieldValidationException;
import io.github.nodoaula.shared.storage.FileStorage;
import io.github.nodoaula.shared.storage.StorageUnavailableException;

/**
 * Cubre la subida de un apunte (historia HU302): la sesión, la validación del
 * PDF y del formulario, el nombre que genera el servidor, lo que se guarda,
 * la compensación si falla el registro y el tope del almacenamiento. También
 * la vista previa que se genera al subirlo (historia HU412).
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

	@TempDir private Path tempDir;

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
		assertEquals(new DocumentFile(key.getValue(), pdf.length, 3, sha256Of(pdf)), saved.getFile());
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
				.andExpect(jsonPath("$[0].title").value(TITLE))
				.andExpect(jsonPath("$[0].pageCount").value(1))
				.andExpect(jsonPath("$[0].durationSeconds").doesNotExist());
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
	void ifTheStorageFailsNothingIsRegisteredAndTheFileIsDeleted() throws Exception {
		doThrow(new StorageUnavailableException(null)).when(fileStorage).store(anyString(), any(), anyString());
		long before = resourceRepository.count();

		mockMvc.perform(upload(file("apunte.pdf", pdf(1))))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("STORAGE_UNAVAILABLE"));

		assertEquals(before, resourceRepository.count());
		// Pudo guardarse aunque la respuesta fallara: se intenta borrar ese mismo archivo.
		ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
		verify(fileStorage).store(key.capture(), any(), anyString());
		verify(fileStorage).delete(key.getValue());
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

	@Test
	void theSameFileUploadedAgainIsRejectedEvenWithAnotherName() throws Exception {
		byte[] pdf = pdf(2);
		mockMvc.perform(upload(file("original.pdf", pdf))).andExpect(status().isCreated());
		long resources = resourceRepository.count();

		mockMvc.perform(upload(file("copia con otro nombre.pdf", pdf)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DOCUMENT_ALREADY_UPLOADED"));

		assertEquals(resources, resourceRepository.count());
		verify(fileStorage, times(1)).store(anyString(), any(), anyString());
	}

	@Test
	void aDifferentFileIsAccepted() throws Exception {
		mockMvc.perform(upload(file("uno.pdf", pdf(1)))).andExpect(status().isCreated());
		mockMvc.perform(upload(file("dos.pdf", pdf(2)))).andExpect(status().isCreated());
	}

	@Test
	void theFingerprintIsStoredWithTheDocument() throws Exception {
		byte[] pdf = pdf(1);
		String body = mockMvc.perform(upload(file("huella.pdf", pdf))).andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		Resource saved = resourceRepository.findById(JsonPath.<Number>read(body, "$.id").longValue()).orElseThrow();
		assertEquals(sha256Of(pdf), saved.getFile().sha256());
	}

	@Test
	void aDocumentOfMoreThanThreePagesIsStoredWithAPreviewOfItsFirstPages() throws Exception {
		byte[] pdf = Files.readAllBytes(
				PdfDocumentsTests.pagesOfWidths(tempDir.resolve("diez.pdf"), 200, 201, 202, 203, 204, 205, 206, 207, 208, 209));
		// El temporal se borra al terminar la subida: se lee mientras se guarda.
		Map<String, List<Float>> storedWidths = new HashMap<>();
		Map<String, Long> storedSizes = new HashMap<>();
		doAnswer(invocation -> {
			Path stored = invocation.getArgument(1);
			storedWidths.put(invocation.getArgument(0), PdfDocumentsTests.widthsOf(stored));
			storedSizes.put(invocation.getArgument(0), Files.size(stored));
			return null;
		}).when(fileStorage).store(anyString(), any(), eq(MediaType.APPLICATION_PDF_VALUE));

		String body = mockMvc.perform(upload(file("diez páginas.pdf", pdf)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		Resource saved = resourceRepository.findById(JsonPath.<Number>read(body, "$.id").longValue()).orElseThrow();
		String fileKey = saved.getFile().key();
		String previewKey = fileKey.replace(".pdf", "-vista-previa.pdf");
		assertEquals(Set.of(fileKey, previewKey), storedWidths.keySet());
		assertEquals(List.of(200f, 201f, 202f), storedWidths.get(previewKey));
		assertEquals(new DocumentPreview(previewKey, storedSizes.get(previewKey), 3), saved.getPreview());
	}

	@Test
	void aDocumentOfThreePagesOrFewerHasNoPreview() throws Exception {
		String body = mockMvc.perform(upload(file("tres páginas.pdf", pdf(3))))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		verify(fileStorage, times(1)).store(anyString(), any(), anyString());
		assertNull(resourceRepository.findById(JsonPath.<Number>read(body, "$.id").longValue()).orElseThrow()
				.getPreview());
	}

	@Test
	void theStorageLimitCountsThePreview() throws Exception {
		byte[] pdf = pdf(10);
		// Cabe el original, pero no el original con su vista previa.
		Course course = courseRepository.save(new Course(COURSE));
		resourceRepository.save(Resource.document("Apunte que casi llena el almacenamiento", null,
				LocalDate.now(BOGOTA), course, AUTHOR_ID,
				new DocumentFile("casi-lleno.pdf", ResourceService.STORAGE_LIMIT_BYTES - pdf.length, 1)));

		mockMvc.perform(upload(file("apunte.pdf", pdf)))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("DOCUMENT_STORAGE_FULL"));

		verify(fileStorage, never()).store(anyString(), any(), anyString());
	}

	@Test
	void withTheStorageFullTheUploadIsRejectedBeforeReadingTheFile() throws Exception {
		Course course = courseRepository.save(new Course(COURSE));
		resourceRepository.save(Resource.document("Apunte que llena el almacenamiento", null, LocalDate.now(BOGOTA),
				course, AUTHOR_ID, new DocumentFile("lleno.pdf", ResourceService.STORAGE_LIMIT_BYTES, 1)));

		// No es un PDF: si se leyera, la respuesta sería el error del archivo.
		mockMvc.perform(upload(file("apunte.pdf", "no soy un pdf".getBytes(StandardCharsets.UTF_8))))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("DOCUMENT_STORAGE_FULL"));
	}

	@Test
	void theStoredBytesIncludeThePreviews() {
		Course course = courseRepository.save(new Course(COURSE));
		Resource document = Resource.document("Apunte con vista previa", null, LocalDate.now(BOGOTA), course,
				AUTHOR_ID, new DocumentFile("con-vista-previa.pdf", 1_000, 10));
		document.attachPreview(new DocumentPreview("con-vista-previa-vista-previa.pdf", 300, 3));
		long before = resourceRepository.totalStoredBytes();

		resourceRepository.saveAndFlush(document);

		assertEquals(before + 1_300, resourceRepository.totalStoredBytes());
	}

	@Test
	void ifStoringThePreviewFailsNothingIsRegisteredAndBothFilesAreDeleted() throws Exception {
		doAnswer(invocation -> {
			if (invocation.<String>getArgument(0).endsWith("-vista-previa.pdf")) {
				throw new StorageUnavailableException(null);
			}
			return null;
		}).when(fileStorage).store(anyString(), any(), anyString());
		long before = resourceRepository.count();

		mockMvc.perform(upload(file("apunte.pdf", pdf(10))))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("STORAGE_UNAVAILABLE"));

		assertEquals(before, resourceRepository.count());
		expectEveryStoredFileDeleted(2);
	}

	@Test
	void ifTheRegistrationFailsTheDocumentAndItsPreviewAreDeleted() throws IOException {
		doThrow(new DataIntegrityViolationException("registro simulado")).when(transactionTemplate).execute(any());
		DocumentUploadRequest request = new DocumentUploadRequest(file("apunte.pdf", pdf(10)), TITLE, null, COURSE,
				List.of("Tema A"), true);

		assertThrows(DataIntegrityViolationException.class, () -> resourceService.createDocument(request, AUTHOR_ID));

		expectEveryStoredFileDeleted(2);
	}

	@Test
	void ifThePreviewCannotBeGeneratedNothingIsStoredOrRegistered() throws Exception {
		Answer<Object> failingPreview = invocation -> {
			if (invocation.getMethod().getName().equals("writePreview")) {
				throw new FieldValidationException("file", "Fallo simulado al generar la vista previa.");
			}
			return invocation.callRealMethod();
		};

		try (MockedStatic<PdfDocuments> _ = mockStatic(PdfDocuments.class, failingPreview)) {
			expectFileRejected(file("apunte.pdf", pdf(10)));
		}
	}

	private void expectEveryStoredFileDeleted(int files) {
		ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
		verify(fileStorage, times(files)).store(keys.capture(), any(), anyString());
		keys.getAllValues().forEach(key -> verify(fileStorage).delete(key));
	}

	private static String sha256Of(byte[] content) throws Exception {
		return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(content));
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
