package io.github.nodoaula.catalog;

import java.text.Normalizer;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Texto de búsqueda libre del catálogo (historia HU207). Cada palabra debe
 * aparecer, en cualquier orden, en el título, la descripción, los temas o el
 * nombre del curso. «apunte», «apuntes», «pdf», «video» y «videos» no se
 * buscan como texto: dejan solo los recursos de ese tipo. Sin distinguir
 * mayúsculas ni tildes.
 */
record TextQuery(List<String> words, Set<ResourceType> types) {

	private static final Map<String, ResourceType> TYPE_WORDS = Map.of(
			"apunte", ResourceType.DOCUMENT,
			"apuntes", ResourceType.DOCUMENT,
			"pdf", ResourceType.DOCUMENT,
			"video", ResourceType.VIDEO,
			"videos", ResourceType.VIDEO);

	static TextQuery parse(String query) {
		List<String> all = query == null ? List.of() : Stream.of(normalize(query).split("\\s+"))
				.filter(word -> !word.isEmpty())
				.toList();
		Set<ResourceType> types = EnumSet.noneOf(ResourceType.class);
		all.stream().map(TYPE_WORDS::get).filter(type -> type != null).forEach(types::add);
		return new TextQuery(all.stream().filter(word -> !TYPE_WORDS.containsKey(word)).toList(), types);
	}

	boolean isEmpty() {
		return words.isEmpty() && types.isEmpty();
	}

	boolean matches(Resource resource) {
		if (!types.isEmpty() && !types.contains(resource.getResourceType())) return false;
		// Separados por espacios: una palabra buscada no los tiene, así que no
		// puede coincidir uniendo el final de un campo con el principio de otro.
		String text = normalize(Stream.concat(
				Stream.of(resource.getTitle(), resource.getDescription(), resource.getCourse().getName()),
				resource.getTopics().stream().map(Topic::getName))
				.filter(value -> value != null)
				.reduce("", (joined, value) -> joined + " " + value));
		return words.stream().allMatch(text::contains);
	}

	// Quita tildes (forma NFD: separa cada letra de su diacrítico, y \p{M}
	// borra el diacrítico) y pasa a minúsculas.
	private static String normalize(String value) {
		String withoutAccents = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
		return withoutAccents.toLowerCase(Locale.ROOT);
	}

}
