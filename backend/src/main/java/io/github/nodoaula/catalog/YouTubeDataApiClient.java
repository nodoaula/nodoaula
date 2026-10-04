package io.github.nodoaula.catalog;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Única clase del backend que conoce a YouTube (historia HU202, ADR-008).
 *
 * Hace una sola llamada por video, según la nota técnica del spike HU201:
 * videos.list con snippet y contentDetails, que cuesta 1 unidad de las 10.000
 * diarias. Nunca search.list, que tiene un cupo aparte de 100 al día.
 *
 * La clave viaja en el encabezado X-goog-api-key y no en la query string, que
 * la API admite igual: así no aparece en la URL que los mensajes de error de
 * RestClient copian al log. Nunca llega al frontend.
 */
@Component
class YouTubeDataApiClient implements VideoMetadataProvider {

	private static final Logger log = LoggerFactory.getLogger(YouTubeDataApiClient.class);

	static final String API_BASE_URL = "https://www.googleapis.com/youtube/v3";

	private static final String API_KEY_HEADER = "X-goog-api-key";

	// Una fecha de publicación es un instante; la del formulario es un día, y
	// el día depende de la zona. Se toma la de los usuarios del proyecto.
	private static final ZoneId PUBLICATION_ZONE = ZoneId.of("America/Bogota");

	// Acotados: sin ellos, una YouTube que no responde retiene un hilo del
	// servidor, y el formulario espera indefinidamente.
	private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
	private static final Duration READ_TIMEOUT = Duration.ofSeconds(5);

	private final RestClient restClient;
	private final String apiKey;

	@Autowired
	YouTubeDataApiClient(@Value("${youtube.api-key:}") String apiKey) {
		this(RestClient.builder().requestFactory(requestFactory()), apiKey);
	}

	// Las pruebas pasan un builder enlazado a MockRestServiceServer.
	YouTubeDataApiClient(RestClient.Builder builder, String apiKey) {
		this.restClient = builder.baseUrl(API_BASE_URL).build();
		this.apiKey = apiKey;
	}

	private static SimpleClientHttpRequestFactory requestFactory() {
		SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(CONNECT_TIMEOUT);
		factory.setReadTimeout(READ_TIMEOUT);
		return factory;
	}

	@Override
	public VideoMetadata fetch(String videoId) {
		// Sin clave la aplicación arranca igual (CI y entornos locales), y la
		// consulta responde como no disponible.
		if (apiKey == null || apiKey.isBlank()) {
			log.warn("No hay clave de la YouTube Data API (YOUTUBE_API_KEY): no se consulta el video {}", videoId);
			throw new VideoMetadataUnavailableException(null);
		}

		VideoListResponse response;
		try {
			response = restClient.get()
					.uri(uri -> uri.path("/videos")
							.queryParam("part", "snippet,contentDetails")
							.queryParam("id", videoId)
							.build())
					.header(API_KEY_HEADER, apiKey)
					.retrieve()
					.body(VideoListResponse.class);
		} catch (RestClientException exception) {
			// Cuota agotada (403 quotaExceeded), clave inválida, 5xx o tiempo
			// agotado. Para el usuario son lo mismo; la causa queda en el log.
			log.error("No se pudo consultar la YouTube Data API para el video {}", videoId, exception);
			throw new VideoMetadataUnavailableException(exception);
		}

		// Un video inexistente, privado o eliminado no da error: llega sin items.
		if (response == null || response.items() == null || response.items().isEmpty()) {
			throw new VideoNotFoundException();
		}

		return toMetadata(response.items().getFirst(), videoId);
	}

	private static VideoMetadata toMetadata(Item item, String videoId) {
		Snippet snippet = item.snippet() == null ? new Snippet(null, null, null, null) : item.snippet();
		String duration = item.contentDetails() == null ? null : item.contentDetails().duration();

		return new VideoMetadata(
				blankToNull(snippet.title()),
				blankToNull(snippet.description()),
				toLocalDate(snippet.publishedAt(), videoId),
				toSeconds(duration, videoId),
				blankToNull(snippet.channelTitle()));
	}

	// Tal cual, salvo que llegue vacío: la descripción llega vacía en 3 de los
	// 5 videos de la semilla, y es el caso normal. No se recorta aunque supere
	// lo que admite el formulario; recortarla lo decide el usuario al editar.
	private static String blankToNull(String value) {
		return (value == null || value.isBlank()) ? null : value;
	}

	private static LocalDate toLocalDate(String publishedAt, String videoId) {
		if (publishedAt == null || publishedAt.isBlank()) return null;
		try {
			return OffsetDateTime.parse(publishedAt).atZoneSameInstant(PUBLICATION_ZONE).toLocalDate();
		} catch (DateTimeParseException exception) {
			log.warn("Fecha de publicación no reconocida para el video {}: {}", videoId, publishedAt);
			return null;
		}
	}

	/**
	 * Duration.parse y no una expresión regular: YouTube omite componentes,
	 * como en PT2H31S, sin minutos. Una duración cero (P0D, la de las
	 * transmisiones en vivo) se trata como ausente, porque el registro exige
	 * una duración positiva.
	 */
	private static Integer toSeconds(String isoDuration, String videoId) {
		if (isoDuration == null || isoDuration.isBlank()) return null;
		try {
			long seconds = Duration.parse(isoDuration).getSeconds();
			return (seconds > 0 && seconds <= Integer.MAX_VALUE) ? (int) seconds : null;
		} catch (DateTimeParseException exception) {
			log.warn("Duración no reconocida para el video {}: {}", videoId, isoDuration);
			return null;
		}
	}

	// Solo los campos que se usan; el resto de la respuesta se ignora.
	@JsonIgnoreProperties(ignoreUnknown = true)
	record VideoListResponse(List<Item> items) {
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record Item(Snippet snippet, ContentDetails contentDetails) {
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record Snippet(String title, String description, String publishedAt, String channelTitle) {
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record ContentDetails(String duration) {
	}

}
