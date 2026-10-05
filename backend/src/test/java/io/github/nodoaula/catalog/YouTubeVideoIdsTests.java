package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Cubre la extracción del identificador de un video de YouTube de lo que se
 * pega en el campo «Enlace» (historia HU202). Debe aceptar las mismas formas
 * que getYouTubeVideoId del frontend, más el identificador suelto; si una de
 * las dos cambia, estas pruebas y las de sourcePlatform.test.js avisan.
 *
 * Arranca el contexto como el resto de pruebas del backend (ADR-009), aunque
 * no lo use: lo comparte con las demás clases de la misma configuración.
 */
@SpringBootTest
class YouTubeVideoIdsTests {

	private static final String ID = "dQw4w9WgXcQ";

	@ParameterizedTest
	@ValueSource(strings = {
			"https://www.youtube.com/watch?v=" + ID,
			"https://youtube.com/watch?v=" + ID,
			"http://www.youtube.com/watch?v=" + ID,
			"https://www.youtube.com/watch?feature=share&v=" + ID + "&t=42",
			"https://youtu.be/" + ID,
			"https://youtu.be/" + ID + "?t=10",
			"https://www.youtube.com/shorts/" + ID,
			"https://www.youtube.com/embed/" + ID,
			"https://www.youtube.com/live/" + ID,
			"https://m.youtube.com/watch?v=" + ID,
			"https://www.youtube-nocookie.com/embed/" + ID,
			"HTTPS://WWW.YOUTUBE.COM/watch?v=" + ID,
			ID,
			"  " + ID + "  ",
			"  https://youtu.be/" + ID + "  "
	})
	void extractsTheIdFromEveryAcceptedForm(String input) {
		assertEquals(Optional.of(ID), YouTubeVideoIds.extract(input));
	}

	@ParameterizedTest
	@NullAndEmptySource
	@ValueSource(strings = {
			// Enlaces de otros sitios: no son de YouTube, aunque traigan un id.
			"https://vimeo.com/76979871",
			"https://ejemplo.com/watch?v=" + ID,
			"https://notyoutube.com/watch?v=" + ID,
			// Identificadores mal formados: cortos, largos o con caracteres ajenos.
			"dQw4w9WgXc",
			"dQw4w9WgXcQQ",
			"dQw4w9WgX!Q",
			"https://www.youtube.com/watch?v=dQw4w9WgXc",
			"https://youtu.be/dQw4w9WgXcQQ",
			// De YouTube, pero sin video.
			"https://www.youtube.com/",
			"https://www.youtube.com/watch",
			"https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw",
			"https://www.youtube.com/playlist?list=PL" + ID,
			// Sin esquema web: un javascript: nunca es un enlace.
			"javascript:alert(1)",
			"youtube.com/watch?v=" + ID,
			"ftp://www.youtube.com/watch?v=" + ID
	})
	void rejectsLinksWithoutARecognizableYouTubeId(String input) {
		assertEquals(Optional.empty(), YouTubeVideoIds.extract(input));
	}

	@Test
	void buildsTheCanonicalWatchUrl() {
		assertEquals("https://www.youtube.com/watch?v=" + ID, YouTubeVideoIds.canonicalUrl(ID));
	}

}
