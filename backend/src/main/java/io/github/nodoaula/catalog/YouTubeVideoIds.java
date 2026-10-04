package io.github.nodoaula.catalog;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Extrae el identificador de un video de YouTube de lo que el usuario pega en
 * el campo «Enlace» (historia HU202).
 *
 * Acepta las mismas formas que getYouTubeVideoId de
 * frontend/src/features/catalog/sourcePlatform.js, más el identificador
 * suelto, para que frontend y backend no discrepen sobre qué es un enlace de
 * YouTube: si cambian allí, cambian aquí.
 */
final class YouTubeVideoIds {

	// Once caracteres de este alfabeto. Comprobarlo evita consultar la API con
	// un identificador inventado.
	private static final Pattern VIDEO_ID = Pattern.compile("[A-Za-z0-9_-]{11}");

	private static final Set<String> YOUTUBE_HOSTS = Set.of("youtube.com", "m.youtube.com", "youtube-nocookie.com");

	// Formas de enlace en las que el id va en la ruta: /embed/<id>, /shorts/<id>...
	private static final Set<String> ID_IN_PATH_SECTIONS = Set.of("embed", "shorts", "live");

	private YouTubeVideoIds() {
	}

	/**
	 * Devuelve el identificador si la entrada es un enlace de YouTube con un
	 * identificador válido o el identificador suelto; vacío en cualquier otro
	 * caso, incluido un enlace de otra plataforma.
	 */
	static Optional<String> extract(String input) {
		if (input == null) return Optional.empty();

		String trimmed = input.strip();
		if (VIDEO_ID.matcher(trimmed).matches()) return Optional.of(trimmed);

		return parseWebUri(trimmed)
				.map(YouTubeVideoIds::candidateFrom)
				.filter(candidate -> VIDEO_ID.matcher(candidate).matches());
	}

	/** La URL que se guarda para un video, sea cual sea la forma en que se pegó. */
	static String canonicalUrl(String videoId) {
		return "https://www.youtube.com/watch?v=" + videoId;
	}

	// Solo http o https, como isWebUrl en el frontend.
	private static Optional<URI> parseWebUri(String value) {
		try {
			URI uri = new URI(value);
			String scheme = uri.getScheme();
			boolean isWeb = "https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme);
			return isWeb && uri.getHost() != null ? Optional.of(uri) : Optional.empty();
		} catch (URISyntaxException exception) {
			return Optional.empty();
		}
	}

	// Cadena vacía cuando el enlace no trae un candidato a identificador; así
	// el filtro posterior lo descarta sin tratar null.
	private static String candidateFrom(URI uri) {
		String host = uri.getHost().toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
		String[] segments = (uri.getPath() == null ? "" : uri.getPath()).split("/");

		if (host.equals("youtu.be")) {
			return segment(segments, 1);
		}
		if (YOUTUBE_HOSTS.contains(host)) {
			String section = segment(segments, 1);
			if (section.equals("watch")) return queryParameter(uri.getRawQuery(), "v");
			if (ID_IN_PATH_SECTIONS.contains(section)) return segment(segments, 2);
		}
		return "";
	}

	private static String segment(String[] segments, int index) {
		return index < segments.length ? segments[index] : "";
	}

	// El primer valor del parámetro, como URLSearchParams.get en el frontend.
	private static String queryParameter(String rawQuery, String name) {
		if (rawQuery == null) return "";
		for (String pair : rawQuery.split("&")) {
			int separator = pair.indexOf('=');
			String key = separator < 0 ? pair : pair.substring(0, separator);
			if (URLDecoder.decode(key, StandardCharsets.UTF_8).equals(name)) {
				return separator < 0 ? "" : URLDecoder.decode(pair.substring(separator + 1), StandardCharsets.UTF_8);
			}
		}
		return "";
	}

}
