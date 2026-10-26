package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.Test;

/** Pruebas de la forma comparable de los nombres de cursos y temas (HU308). */
class NameNormalizerTests {

	@Test
	void ignoresCaseAndAccents() {
		assertEquals("gestion de proyectos", NameNormalizer.normalize("Gestión de Proyectos"));
		assertEquals(NameNormalizer.normalize("Programación"), NameNormalizer.normalize("PROGRAMACION"));
	}

	@Test
	void ignoresSurroundingAndRepeatedSpaces() {
		assertEquals("analisis y diseno", NameNormalizer.normalize("  Análisis   y\tdiseño "));
	}

	@Test
	void keepsDifferentNamesDifferent() {
		assertNotEquals(NameNormalizer.normalize("Bases de datos 1"), NameNormalizer.normalize("Bases de datos 2"));
	}

}
