package io.github.nodoaula.catalog;

import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.SocketTimeoutException;
import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * Cubre el cliente de la YouTube Data API (historia HU202): la llamada única
 * que fijó el spike HU201, la conversión de cada campo y el trato de los
 * errores.
 *
 * La API real nunca se llama: tiene cuota y no es parte del sistema. Solo se
 * sustituye esa frontera, el RestClient, con MockRestServiceServer (ADR-009);
 * las respuestas imitan la forma de las reales de videos.list.
 */
@SpringBootTest
class YouTubeDataApiClientTests {

	private static final String VIDEO_ID = "yhUh4ZmM45w";
	private static final String API_KEY = "clave-de-prueba";

	private MockRestServiceServer server;
	private YouTubeDataApiClient client;

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder();
		server = MockRestServiceServer.bindTo(builder).build();
		client = new YouTubeDataApiClient(builder, API_KEY);
	}

	private static String videoJson(String snippet, String contentDetails) {
		return """
				{
				  "kind": "youtube#videoListResponse",
				  "items": [
				    {
				      "kind": "youtube#video",
				      "id": "%s",
				      "snippet": %s,
				      "contentDetails": %s
				    }
				  ],
				  "pageInfo": { "totalResults": 1, "resultsPerPage": 1 }
				}
				""".formatted(VIDEO_ID, snippet, contentDetails);
	}

	private void expectVideoRequestReturning(String json) {
		server.expect(requestTo(startsWith(YouTubeDataApiClient.API_BASE_URL + "/videos")))
				.andExpect(method(HttpMethod.GET))
				.andExpect(queryParam("part", "snippet,contentDetails"))
				.andExpect(queryParam("id", VIDEO_ID))
				.andExpect(header("X-goog-api-key", API_KEY))
				.andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
	}

	@Test
	void makesASingleVideosListCallAndConvertsEveryField() {
		expectVideoRequestReturning(videoJson("""
				{
				  "publishedAt": "2026-09-06T15:30:00Z",
				  "channelId": "UC123",
				  "title": "Azure DevOps desde la creación del proyecto",
				  "description": "Recorrido completo por Azure DevOps.",
				  "channelTitle": "Fábrica Escuela - Canal de Formación",
				  "tags": ["azure"]
				}
				""", """
				{ "duration": "PT39M31S", "dimension": "2d", "definition": "hd" }
				"""));

		VideoMetadata metadata = client.fetch(VIDEO_ID);

		server.verify();
		assertEquals("Azure DevOps desde la creación del proyecto", metadata.title());
		assertEquals("Recorrido completo por Azure DevOps.", metadata.description());
		assertEquals(LocalDate.of(2026, 9, 6), metadata.publishedAt());
		assertEquals(39 * 60 + 31, metadata.durationSeconds());
		assertEquals("Fábrica Escuela - Canal de Formación", metadata.channel());
	}

	@Test
	void parsesDurationsThatOmitComponents() {
		expectVideoRequestReturning(videoJson("""
				{ "title": "Sin minutos", "publishedAt": "2026-09-10T12:00:00Z" }
				""", """
				{ "duration": "PT2H31S" }
				"""));

		assertEquals(2 * 3600 + 31, client.fetch(VIDEO_ID).durationSeconds());
	}

	@Test
	void treatsAZeroDurationAsMissing() {
		// Las transmisiones en vivo llegan con P0D; el registro exige duración positiva.
		expectVideoRequestReturning(videoJson("""
				{ "title": "En vivo", "publishedAt": "2026-09-10T12:00:00Z" }
				""", """
				{ "duration": "P0D" }
				"""));

		assertNull(client.fetch(VIDEO_ID).durationSeconds());
	}

	@Test
	void convertsThePublicationInstantToTheDateInBogota() {
		// 03:00 UTC del 6 son las 22:00 del 5 en Bogotá (UTC-5).
		expectVideoRequestReturning(videoJson("""
				{ "title": "Medianoche", "publishedAt": "2026-09-06T03:00:00Z" }
				""", """
				{ "duration": "PT1M" }
				"""));

		assertEquals(LocalDate.of(2026, 9, 5), client.fetch(VIDEO_ID).publishedAt());
	}

	@Test
	void returnsBlankOrMissingFieldsAsNullWithoutInventingThem() {
		// La descripción vacía es el caso normal (3 de los 5 videos de la semilla).
		expectVideoRequestReturning(videoJson("""
				{ "title": "Solo título", "description": "", "channelTitle": "   " }
				""", "{}"));

		VideoMetadata metadata = client.fetch(VIDEO_ID);

		assertEquals("Solo título", metadata.title());
		assertNull(metadata.description());
		assertNull(metadata.publishedAt());
		assertNull(metadata.durationSeconds());
		assertNull(metadata.channel());
	}

	@Test
	void returnsTheDescriptionCompleteEvenBeyondTheFormLimit() {
		String longDescription = "a".repeat(2500);
		expectVideoRequestReturning(videoJson("""
				{ "title": "Larga", "description": "%s" }
				""".formatted(longDescription), "{}"));

		assertEquals(longDescription, client.fetch(VIDEO_ID).description());
	}

	@Test
	void reportsAVideoThatDoesNotExistIsPrivateOrWasDeleted() {
		expectVideoRequestReturning("""
				{ "kind": "youtube#videoListResponse", "items": [], "pageInfo": { "totalResults": 0 } }
				""");

		assertThrows(VideoNotFoundException.class, () -> client.fetch(VIDEO_ID));
	}

	@Test
	void reportsAnExhaustedQuotaAsUnavailable() {
		server.expect(requestTo(startsWith(YouTubeDataApiClient.API_BASE_URL)))
				.andRespond(withStatus(HttpStatus.FORBIDDEN).contentType(MediaType.APPLICATION_JSON).body("""
						{ "error": { "code": 403, "errors": [ { "reason": "quotaExceeded" } ] } }
						"""));

		assertThrows(VideoMetadataUnavailableException.class, () -> client.fetch(VIDEO_ID));
	}

	@Test
	void reportsAnInvalidKeyAsUnavailable() {
		server.expect(requestTo(startsWith(YouTubeDataApiClient.API_BASE_URL)))
				.andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON).body("""
						{ "error": { "code": 400, "errors": [ { "reason": "keyInvalid" } ] } }
						"""));

		assertThrows(VideoMetadataUnavailableException.class, () -> client.fetch(VIDEO_ID));
	}

	@Test
	void reportsAServerErrorAsUnavailable() {
		server.expect(requestTo(startsWith(YouTubeDataApiClient.API_BASE_URL)))
				.andRespond(withServerError());

		assertThrows(VideoMetadataUnavailableException.class, () -> client.fetch(VIDEO_ID));
	}

	@Test
	void reportsATimeoutAsUnavailable() {
		server.expect(requestTo(startsWith(YouTubeDataApiClient.API_BASE_URL)))
				.andRespond(withException(new SocketTimeoutException("Read timed out")));

		assertThrows(VideoMetadataUnavailableException.class, () -> client.fetch(VIDEO_ID));
	}

	@Test
	void withoutAKeyReportsUnavailableWithoutCallingYouTube() {
		RestClient.Builder builder = RestClient.builder();
		MockRestServiceServer keylessServer = MockRestServiceServer.bindTo(builder).build();
		keylessServer.expect(ExpectedCount.never(), requestTo(startsWith(YouTubeDataApiClient.API_BASE_URL)));
		YouTubeDataApiClient keylessClient = new YouTubeDataApiClient(builder, "");

		assertThrows(VideoMetadataUnavailableException.class, () -> keylessClient.fetch(VIDEO_ID));
		keylessServer.verify();
	}

}
