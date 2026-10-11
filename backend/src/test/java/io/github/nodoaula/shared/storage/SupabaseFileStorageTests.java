package io.github.nodoaula.shared.storage;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * Cubre el cliente de Supabase Storage: la petición que envía al guardar y al
 * borrar, y el trato de los errores. Supabase nunca se llama: se sustituye el
 * RestClient con MockRestServiceServer.
 */
class SupabaseFileStorageTests {

	private static final String URL = "https://proyecto.supabase.co";
	private static final String SECRET_KEY = "clave-de-prueba";
	private static final String BUCKET = "notes-dev";
	private static final String OBJECT_URL = URL + "/storage/v1/object/" + BUCKET + "/apunte.pdf";

	@TempDir
	private Path tempDir;

	private MockRestServiceServer server;
	private SupabaseFileStorage storage;

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder();
		server = MockRestServiceServer.bindTo(builder).build();
		storage = new SupabaseFileStorage(builder, URL, SECRET_KEY, BUCKET);
	}

	@Test
	void storesTheFileInTheBucketWithTheSecretKey() throws IOException {
		byte[] bytes = "%PDF-1.7 contenido".getBytes(StandardCharsets.US_ASCII);
		Path file = Files.write(tempDir.resolve("subida.tmp"), bytes);
		server.expect(requestTo(OBJECT_URL))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header("apikey", SECRET_KEY))
				.andExpect(content().contentType(MediaType.APPLICATION_PDF))
				.andExpect(content().bytes(bytes))
				.andRespond(withSuccess("{\"Key\":\"notes-dev/apunte.pdf\"}", MediaType.APPLICATION_JSON));

		storage.store("apunte.pdf", file, MediaType.APPLICATION_PDF_VALUE);

		server.verify();
	}

	@Test
	void deletesTheFileFromTheBucketWithTheSecretKey() {
		server.expect(requestTo(OBJECT_URL))
				.andExpect(method(HttpMethod.DELETE))
				.andExpect(header("apikey", SECRET_KEY))
				.andRespond(withSuccess("{\"message\":\"Successfully deleted\"}", MediaType.APPLICATION_JSON));

		storage.delete("apunte.pdf");

		server.verify();
	}

	@Test
	void aStorageErrorBecomesUnavailable() throws IOException {
		Path file = Files.write(tempDir.resolve("subida.tmp"), new byte[] { 1 });
		server.expect(requestTo(OBJECT_URL)).andRespond(withServerError());

		assertThrows(StorageUnavailableException.class,
				() -> storage.store("apunte.pdf", file, MediaType.APPLICATION_PDF_VALUE));
	}

	@Test
	void withoutConfigurationNothingIsSentAndItIsUnavailable() {
		RestClient.Builder builder = RestClient.builder();
		MockRestServiceServer unusedServer = MockRestServiceServer.bindTo(builder).build();
		SupabaseFileStorage unconfigured = new SupabaseFileStorage(builder, "", "", "");

		assertThrows(StorageUnavailableException.class, () -> unconfigured.delete("apunte.pdf"));
		unusedServer.verify();
	}

	@Test
	void deletingAFileThatDoesNotExistIsNotAnError() {
		server.expect(requestTo(OBJECT_URL))
				.andExpect(method(HttpMethod.DELETE))
				.andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
						.body("{\"statusCode\":\"404\",\"error\":\"not_found\",\"message\":\"Object not found\",\"code\":\"NoSuchKey\"}"));

		assertDoesNotThrow(() -> storage.delete("apunte.pdf"));
	}

	@Test
	void anyOtherRejectionWhenDeletingIsUnavailable() {
		server.expect(requestTo(OBJECT_URL))
				.andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
						.body("{\"statusCode\":\"400\",\"error\":\"Error\",\"code\":\"InvalidRequest\"}"));

		assertThrows(StorageUnavailableException.class, () -> storage.delete("apunte.pdf"));
	}

	// Un servidor que acepta la conexión y nunca lee: el envío se atasca en
	// cuanto se llenan los búferes del sistema, y solo el plazo total lo corta.
	@Test
	void anUploadThatStallsIsCutAtTheRequestTimeout() throws IOException {
		Path file = Files.write(tempDir.resolve("grande.tmp"), new byte[8 * 1024 * 1024]);
		try (ServerSocket stalled = new ServerSocket(0)) {
			Thread.ofVirtual().start(() -> {
				try (Socket _ = stalled.accept()) {
					Thread.sleep(Duration.ofSeconds(30));
				} catch (IOException _) {
					// La prueba terminó y cerró el servidor.
				} catch (InterruptedException _) {
					Thread.currentThread().interrupt();
				}
			});
			SupabaseFileStorage slow = new SupabaseFileStorage(
					RestClient.builder().requestFactory(SupabaseFileStorage.requestFactory(Duration.ofSeconds(2))),
					"http://127.0.0.1:" + stalled.getLocalPort(), SECRET_KEY, BUCKET);

			assertTimeoutPreemptively(Duration.ofSeconds(15), () -> assertThrows(StorageUnavailableException.class,
					() -> slow.store("apunte.pdf", file, MediaType.APPLICATION_PDF_VALUE)));
		}
	}

}
