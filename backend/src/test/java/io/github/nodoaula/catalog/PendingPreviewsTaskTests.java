package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import io.github.nodoaula.shared.storage.FileStorage;
import io.github.nodoaula.shared.storage.StorageUnavailableException;
import io.github.nodoaula.shared.storage.TransferQuota;

/**
 * Cubre la vista previa de los apuntes subidos antes de la historia HU412: se
 * descarga el original, contando su transferencia, se genera y se registra. El
 * almacenamiento y el contador se sustituyen, como en las pruebas del enlace.
 */
@SpringBootTest
@Transactional
class PendingPreviewsTaskTests {

	private static final Long AUTHOR_ID = 999L;

	@Autowired private PendingPreviewsTask task;
	@Autowired private ResourceRepository resourceRepository;
	@Autowired private CourseRepository courseRepository;

	@MockitoBean private FileStorage fileStorage;
	@MockitoBean private TransferQuota transferQuota;
	@MockitoSpyBean private TransactionTemplate transactionTemplate;

	@TempDir private Path tempDir;

	private Course course;
	private final Map<String, Path> stored = new HashMap<>();

	@BeforeEach
	void setUp() {
		course = courseRepository.save(new Course("Curso de la prueba de vistas previas pendientes"));
		when(transferQuota.reserve(anyLong())).thenReturn(true);
		// Lo guardado se copia antes de que la tarea borre sus temporales.
		doAnswer(invocation -> {
			Path copy = tempDir.resolve("guardado-" + stored.size() + ".pdf");
			Files.copy(invocation.<Path>getArgument(1), copy);
			stored.put(invocation.getArgument(0), copy);
			return null;
		}).when(fileStorage).store(anyString(), any(), anyString());
	}

	@Test
	void anOldDocumentGetsThePreviewOfItsFirstPages() throws IOException {
		Path original = PdfDocumentsTests.pagesOfWidths(tempDir.resolve("original.pdf"),
				200, 201, 202, 203, 204, 205, 206, 207, 208, 209);
		Resource document = saveDocument("antiguo.pdf", Files.size(original), 10);
		downloadsAs("antiguo.pdf", original);

		task.generatePendingPreviews();

		verify(transferQuota).reserve(Files.size(original));
		Path preview = stored.get("antiguo-vista-previa.pdf");
		assertEquals(List.of(200f, 201f, 202f), PdfDocumentsTests.widthsOf(preview));
		verify(fileStorage).store(eq("antiguo-vista-previa.pdf"), any(), eq(MediaType.APPLICATION_PDF_VALUE));
		assertEquals(new DocumentPreview("antiguo-vista-previa.pdf", Files.size(preview), 3),
				resourceRepository.findById(document.getId()).orElseThrow().getPreview());
	}

	@Test
	void documentsOfThreePagesOrFewerAndThoseWithAPreviewAreLeftAlone() {
		saveDocument("corto.pdf", 2048, 3);
		Resource withPreview = saveDocument("con-vista.pdf", 2048, 10);
		withPreview.attachPreview(new DocumentPreview("con-vista-vista-previa.pdf", 512, 3));
		resourceRepository.saveAndFlush(withPreview);

		task.generatePendingPreviews();

		verify(fileStorage, never()).download(anyString(), any());
		verify(fileStorage, never()).store(anyString(), any(), anyString());
	}

	@Test
	void aDocumentThatFailsDoesNotStopTheNextOne() throws IOException {
		Path original = PdfDocumentsTests.pagesOfWidths(tempDir.resolve("original.pdf"), 200, 201, 202, 203);
		saveDocument("falla.pdf", 2048, 4);
		Resource next = saveDocument("sigue.pdf", Files.size(original), 4);
		doThrow(new StorageUnavailableException(null)).when(fileStorage).download(eq("falla.pdf"), any());
		downloadsAs("sigue.pdf", original);

		task.generatePendingPreviews();

		assertNotNull(resourceRepository.findById(next.getId()).orElseThrow().getPreview());
	}

	@Test
	void withoutTransferLeftNothingIsDownloaded() {
		saveDocument("sin-transferencia.pdf", 2048, 10);
		when(transferQuota.reserve(anyLong())).thenReturn(false);

		task.generatePendingPreviews();

		verify(fileStorage, never()).download(anyString(), any());
	}

	@Test
	void aPreviewThatWouldPassTheStorageLimitIsNotStored() throws IOException {
		Path original = PdfDocumentsTests.pagesOfWidths(tempDir.resolve("original.pdf"), 200, 201, 202, 203);
		Resource document = saveDocument("lleno.pdf", ResourceService.STORAGE_LIMIT_BYTES, 4);
		downloadsAs("lleno.pdf", original);

		task.generatePendingPreviews();

		verify(fileStorage, never()).store(anyString(), any(), anyString());
		assertNull(resourceRepository.findById(document.getId()).orElseThrow().getPreview());
	}

	@Test
	void ifTheRegistrationFailsTheStoredPreviewIsDeleted() throws IOException {
		Path original = PdfDocumentsTests.pagesOfWidths(tempDir.resolve("original.pdf"), 200, 201, 202, 203);
		saveDocument("registro.pdf", Files.size(original), 4);
		downloadsAs("registro.pdf", original);
		doThrow(new DataIntegrityViolationException("registro simulado"))
				.when(transactionTemplate).executeWithoutResult(any());

		task.generatePendingPreviews();

		InOrder order = inOrder(fileStorage);
		order.verify(fileStorage).store(eq("registro-vista-previa.pdf"), any(), anyString());
		order.verify(fileStorage).delete("registro-vista-previa.pdf");
	}

	// Guardar nunca reemplaza: la que dejó una ejecución que no llegó a
	// registrarla se borra antes, o fallaría en cada arranque.
	@Test
	void aPreviewLeftByAnEarlierRunIsReplaced() throws IOException {
		Path original = PdfDocumentsTests.pagesOfWidths(tempDir.resolve("original.pdf"), 200, 201, 202, 203);
		saveDocument("sobrante.pdf", Files.size(original), 4);
		downloadsAs("sobrante.pdf", original);

		task.generatePendingPreviews();

		InOrder order = inOrder(fileStorage);
		order.verify(fileStorage).delete("sobrante-vista-previa.pdf");
		order.verify(fileStorage).store(eq("sobrante-vista-previa.pdf"), any(), anyString());
	}

	private Resource saveDocument(String key, long sizeBytes, int pageCount) {
		return resourceRepository.saveAndFlush(Resource.document("Apunte " + key, null, LocalDate.of(2026, 10, 20),
				course, AUTHOR_ID, new DocumentFile(key, sizeBytes, pageCount)));
	}

	private void downloadsAs(String key, Path original) {
		doAnswer(invocation -> {
			Files.copy(original, invocation.<Path>getArgument(1), StandardCopyOption.REPLACE_EXISTING);
			return null;
		}).when(fileStorage).download(eq(key), any());
	}

}
