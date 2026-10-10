package io.github.nodoaula.catalog;

import java.io.IOException;
import java.nio.file.Path;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;

import io.github.nodoaula.shared.error.FieldValidationException;

/**
 * Comprueba que un archivo sea un PDF que se puede abrir, sin fiarse de su
 * extensión ni del tipo que declara el navegador (historia HU302).
 */
final class PdfDocuments {

	private PdfDocuments() {
	}

	/**
	 * PDFBox lee del disco a medida que lo necesita, sin cargar el archivo
	 * entero en memoria. Un PDF que solo restringe permisos, como imprimir,
	 * se abre sin contraseña y se acepta.
	 */
	static int countPages(Path file) {
		try (PDDocument document = Loader.loadPDF(file.toFile())) {
			int pages = document.getNumberOfPages();
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

	private static FieldValidationException invalid() {
		return new FieldValidationException("file", "El archivo no es un PDF válido.");
	}

}
