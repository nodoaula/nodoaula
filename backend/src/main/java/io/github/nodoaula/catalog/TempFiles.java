package io.github.nodoaula.catalog;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.multipart.MultipartFile;

/**
 * Copias en disco de los PDF mientras se procesan (historias HU302 y HU412):
 * PDFBox los lee desde el disco y el almacenamiento los sube desde la misma
 * copia.
 */
final class TempFiles {

	private static final Logger log = LoggerFactory.getLogger(TempFiles.class);

	private TempFiles() {
	}

	static Path copyOf(MultipartFile upload) {
		Path pdf = create("apunte-");
		try {
			upload.transferTo(pdf);
			return pdf;
		} catch (IOException exception) {
			delete(pdf);
			throw new UncheckedIOException(exception);
		}
	}

	static Path create(String prefix) {
		try {
			return Files.createTempFile(prefix, ".pdf");
		} catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
	}

	/** SHA-256 del contenido, en hexadecimal. */
	static String sha256Of(Path file) {
		try (InputStream in = Files.newInputStream(file)) {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] buffer = new byte[8192];
			for (int read = in.read(buffer); read != -1; read = in.read(buffer)) {
				digest.update(buffer, 0, read);
			}
			return HexFormat.of().formatHex(digest.digest());
		} catch (IOException exception) {
			throw new UncheckedIOException(exception);
		} catch (NoSuchAlgorithmException exception) {
			// SHA-256 viene en todas las JVM: no puede faltar.
			throw new IllegalStateException(exception);
		}
	}

	static void delete(Path pdf) {
		try {
			Files.deleteIfExists(pdf);
		} catch (IOException exception) {
			log.warn("No se pudo borrar el temporal {}", pdf, exception);
		}
	}

}
