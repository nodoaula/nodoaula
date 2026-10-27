package io.github.nodoaula.catalog;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.multipdf.Splitter;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;

import io.github.nodoaula.shared.error.FieldValidationException;

/**
 * Comprueba que un archivo sea un PDF que se puede abrir, sin fiarse de su
 * extensión ni del tipo que declara el navegador (historia HU302), y genera
 * su vista previa (historia HU412).
 */
final class PdfDocuments {

	private PdfDocuments() {
	}

	/**
	 * PDFBox lee del disco a medida que lo necesita, sin cargar el archivo
	 * entero en memoria. Un PDF que solo restringe permisos, como imprimir,
	 * se abre sin contraseña y se acepta. Las páginas se recorren en vez de
	 * leer el total que declara el PDF: uno mal formado puede declarar páginas
	 * que no trae.
	 */
	static int countPages(Path file) {
		try (PDDocument document = Loader.loadPDF(file.toFile())) {
			int pages = 0;
			for (var _ : document.getPages()) {
				pages++;
			}
			if (pages == 0) {
				throw invalid();
			}
			return pages;
		} catch (InvalidPasswordException _) {
			throw new FieldValidationException("file", "El PDF está protegido con contraseña. Súbelo sin ella.");
		} catch (IOException _) {
			throw invalid();
		}
	}

	/**
	 * Páginas de la vista previa: el 30 %, redondeando hacia abajo. Con 3
	 * páginas o menos da 0, y el apunte no tiene vista previa.
	 */
	static int previewPageCount(int pageCount) {
		return pageCount * 3 / 10;
	}

	/**
	 * Escribe en {@code target} un PDF con las primeras {@code pages} páginas y
	 * devuelve su tamaño en bytes. Splitter solo copia los recursos que esas
	 * páginas usan, y los flujos intermedios van a archivos temporales en vez
	 * de a memoria. Si no salen exactamente esas páginas, el PDF está dañado y
	 * se rechaza.
	 */
	static long writePreview(Path source, int pages, Path target) {
		try (PDDocument document = Loader.loadPDF(source.toFile(), IOUtils.createTempFileOnlyStreamCache())) {
			Splitter splitter = new Splitter();
			splitter.setStreamCacheCreateFunction(IOUtils.createTempFileOnlyStreamCache());
			// Sin el final, también partiría el resto del apunte en documentos
			// que nadie usa.
			splitter.setEndPage(pages);
			splitter.setSplitAtPage(pages);
			List<PDDocument> parts = splitter.split(document);
			try (PDDocument preview = parts.isEmpty() ? null : parts.getFirst()) {
				if (preview == null || preview.getNumberOfPages() != pages) {
					throw previewFailed();
				}
				preview.save(target.toFile());
			}
			return Files.size(target);
		} catch (IOException _) {
			throw previewFailed();
		}
	}

	private static FieldValidationException previewFailed() {
		return new FieldValidationException("file",
				"No se pudo preparar la vista previa de este PDF. Guárdalo de nuevo como PDF y vuelve a subirlo.");
	}

	private static FieldValidationException invalid() {
		return new FieldValidationException("file", "El archivo no es un PDF válido.");
	}

}
