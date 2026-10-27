package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.IntStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import io.github.nodoaula.shared.error.FieldValidationException;

/** Cubre cuántas páginas lleva la vista previa de un apunte y cómo se genera (historia HU412). */
class PdfDocumentsTests {

	@TempDir
	private Path tempDir;

	@ParameterizedTest
	@CsvSource({ "1, 0", "3, 0", "4, 1", "9, 2", "10, 3", "14, 4", "205, 61" })
	void thePreviewHasThirtyPercentOfThePagesRoundedDown(int pageCount, int previewPages) {
		assertEquals(previewPages, PdfDocuments.previewPageCount(pageCount));
	}

	@Test
	void thePreviewKeepsTheFirstPagesUnchanged() throws IOException {
		Path source = pagesOfWidths(tempDir.resolve("apunte.pdf"), 200, 201, 202, 203, 204, 205, 206, 207, 208, 209);
		Path preview = tempDir.resolve("vista-previa.pdf");

		PdfDocuments.writePreview(source, 3, preview);

		assertEquals(List.of(200f, 201f, 202f), widthsOf(preview));
	}

	@Test
	void aPreviewThatCannotBeGeneratedIsAnErrorOfTheFile() throws IOException {
		Path notAPdf = Files.writeString(tempDir.resolve("apunte.pdf"), "no soy un pdf");

		FieldValidationException exception = assertThrows(FieldValidationException.class,
				() -> PdfDocuments.writePreview(notAPdf, 1, tempDir.resolve("vista-previa.pdf")));

		assertEquals("file", exception.getField());
	}

	// Un PDF que declara más páginas de las que trae: countPages se fía de lo
	// declarado, y la vista previa saldría con menos páginas de las que se
	// registrarían.
	@ParameterizedTest
	@CsvSource({ "1, 10", "0, 10" })
	void aPdfThatDeclaresPagesItDoesNotHaveHasNoPreview(int realPages, int declaredPages) throws IOException {
		Path source = tempDir.resolve("roto.pdf");
		try (PDDocument document = new PDDocument()) {
			for (int i = 0; i < realPages; i++) {
				document.addPage(new PDPage());
			}
			document.getDocumentCatalog().getCOSObject().getCOSDictionary(COSName.PAGES)
					.setInt(COSName.COUNT, declaredPages);
			document.save(source.toFile());
		}

		FieldValidationException exception = assertThrows(FieldValidationException.class,
				() -> PdfDocuments.writePreview(source, 3, tempDir.resolve("vista-previa.pdf")));

		assertEquals("file", exception.getField());
	}

	/** Un PDF cuyas páginas se distinguen por su ancho, en puntos. */
	static Path pagesOfWidths(Path target, int... widths) throws IOException {
		try (PDDocument document = new PDDocument()) {
			for (int width : widths) {
				document.addPage(new PDPage(new PDRectangle(width, 300)));
			}
			document.save(target.toFile());
		}
		return target;
	}

	static List<Float> widthsOf(Path pdf) throws IOException {
		try (PDDocument document = Loader.loadPDF(pdf.toFile())) {
			return IntStream.range(0, document.getNumberOfPages())
					.mapToObj(index -> document.getPage(index).getMediaBox().getWidth())
					.toList();
		}
	}

}
