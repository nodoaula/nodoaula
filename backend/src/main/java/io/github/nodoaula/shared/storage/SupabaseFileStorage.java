package io.github.nodoaula.shared.storage;

import java.nio.file.Path;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Única clase del backend que conoce a Supabase Storage.
 *
 * El archivo se envía leyéndolo del disco por partes, sin cargarlo entero en
 * memoria: la instancia no tiene memoria para varias subidas de 20 MB a la vez.
 */
@Component
class SupabaseFileStorage implements FileStorage {

	private static final Logger log = LoggerFactory.getLogger(SupabaseFileStorage.class);

	private static final String API_KEY_HEADER = "apikey";

	private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
	// Holgado a propósito: Supabase responde en menos de un segundo tras recibir
	// el archivo, y cortar antes de tiempo dejaría un archivo guardado sin registro.
	private static final Duration READ_TIMEOUT = Duration.ofSeconds(30);

	private final RestClient restClient;
	private final String secretKey;
	private final String bucket;
	private final boolean configured;

	@Autowired
	SupabaseFileStorage(@Value("${supabase.url:}") String url, @Value("${supabase.secret-key:}") String secretKey,
			@Value("${supabase.storage.bucket:}") String bucket) {
		this(RestClient.builder().requestFactory(requestFactory()), url, secretKey, bucket);
	}

	// Las pruebas pasan un builder enlazado a MockRestServiceServer.
	SupabaseFileStorage(RestClient.Builder builder, String url, String secretKey, String bucket) {
		this.restClient = builder.baseUrl(url + "/storage/v1/object").build();
		this.secretKey = secretKey;
		this.bucket = bucket;
		this.configured = !url.isBlank() && !secretKey.isBlank() && !bucket.isBlank();
	}

	private static SimpleClientHttpRequestFactory requestFactory() {
		SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(CONNECT_TIMEOUT);
		factory.setReadTimeout(READ_TIMEOUT);
		return factory;
	}

	@Override
	public void store(String key, Path file, String contentType) {
		requireConfiguration(key);
		try {
			restClient.post()
					.uri("/{bucket}/{key}", bucket, key)
					.header(API_KEY_HEADER, secretKey)
					.contentType(MediaType.parseMediaType(contentType))
					.body(new FileSystemResource(file))
					.retrieve()
					.toBodilessEntity();
		} catch (RestClientException exception) {
			log.error("No se pudo guardar el archivo {} en Supabase Storage", key, exception);
			throw new StorageUnavailableException(exception);
		}
	}

	@Override
	public void delete(String key) {
		requireConfiguration(key);
		try {
			restClient.delete()
					.uri("/{bucket}/{key}", bucket, key)
					.header(API_KEY_HEADER, secretKey)
					.retrieve()
					.toBodilessEntity();
		} catch (RestClientException exception) {
			log.error("No se pudo borrar el archivo {} de Supabase Storage", key, exception);
			throw new StorageUnavailableException(exception);
		}
	}

	// Sin configuración la aplicación arranca igual (CI y entornos locales), y
	// guardar o borrar responde como no disponible.
	private void requireConfiguration(String key) {
		if (!configured) {
			log.warn("Supabase Storage sin configurar (SUPABASE_*): no se procesa el archivo {}", key);
			throw new StorageUnavailableException(null);
		}
	}

}
