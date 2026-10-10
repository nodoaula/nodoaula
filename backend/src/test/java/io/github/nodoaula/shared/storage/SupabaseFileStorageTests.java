package io.github.nodoaula.shared.storage;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpMethod;
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

}
