package io.github.nodoaula;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

import org.springframework.core.io.ClassPathResource;

/**
 * Para probar los datos que corrige una migración. Flyway la aplicó al
 * arrancar, sobre lo que hubiera en la base, de modo que la prueba no puede
 * volver a ejecutarla entera; ejecuta su update sobre filas que ella misma
 * crea, dentro de su transacción, que lo deshace al terminar.
 */
public final class MigrationScripts {

	private MigrationScripts() {
	}

	/** La sentencia de la migración que empieza por update, sin su punto y coma. */
	public static String updateStatementOf(String migration) {
		String script = read("db/migration/" + migration);
		int start = script.indexOf("\nupdate ");
		int end = script.indexOf(';', start);
		if (start < 0 || end < 0) {
			throw new IllegalArgumentException("La migración " + migration + " no tiene un update");
		}
		return script.substring(start + 1, end);
	}

	private static String read(String path) {
		try {
			return new ClassPathResource(path).getContentAsString(StandardCharsets.UTF_8);
		} catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
	}

}
