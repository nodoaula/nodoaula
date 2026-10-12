package io.github.nodoaula.catalog;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Forma comparable del nombre de un curso o de un tema (historia HU308): sin
 * mayúsculas, sin tildes y con los espacios sobrantes quitados. Dos nombres
 * con la misma forma son el mismo curso o el mismo tema.
 *
 * La migración V202610121800 calcula esto mismo en SQL para los datos que ya
 * existían; si cambia una, hay que cambiar la otra.
 */
final class NameNormalizer {

	private NameNormalizer() {
	}

	static String normalize(String name) {
		String collapsed = name.strip().replaceAll("\\s+", " ");
		// Forma NFD: separa cada letra de su diacrítico, y \p{M} borra el diacrítico.
		String withoutAccents = Normalizer.normalize(collapsed, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
		return withoutAccents.toLowerCase(Locale.ROOT);
	}

}
