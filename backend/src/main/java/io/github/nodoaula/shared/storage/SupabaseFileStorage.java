package io.github.nodoaula.shared.storage;

import java.net.URI;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

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
	private static final String OBJECT_PATH = "/{bucket}/{key}";

	private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
	// Plazo de la petición entera, envío incluido: un Supabase que deja de leer
	// a mitad de una subida no retiene el hilo más que esto. Un PDF de 20 MB
	// tardó 6 s incluso desde una conexión doméstica.
	private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);

	private final RestClient restClient;
	private final String storageUrl;
	private final String secretKey;
	private final String bucket;
	private final boolean configured;

	@Autowired
	SupabaseFileStorage(@Value("${supabase.url:}") String url, @Value("${supabase.secret-key:}") String secretKey,
			@Value("${supabase.storage.bucket:}") String bucket) {
		this(RestClient.builder().requestFactory(requestFactory(REQUEST_TIMEOUT)), url, secretKey, bucket);
	}

	// Las pruebas pasan un builder enlazado a MockRestServiceServer.
	SupabaseFileStorage(RestClient.Builder builder, String url, String secretKey, String bucket) {
		this.storageUrl = url + "/storage/v1";
		this.restClient = builder.baseUrl(storageUrl + "/object").build();
		this.secretKey = secretKey;
		this.bucket = bucket;
		this.configured = !url.isBlank() && !secretKey.isBlank() && !bucket.isBlank();
	}

	// El cliente de Java y no HttpURLConnection: este solo limita la espera de
	// la respuesta, y una subida que se atasca mientras se envía no se cortaría.
	static JdkClientHttpRequestFactory requestFactory(Duration requestTimeout) {
		HttpClient client = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
		JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(client);
		factory.setReadTimeout(requestTimeout);
		return factory;
	}

	@Override
	public void store(String key, Path file, String contentType) {
		requireConfiguration(key);
		try {
			restClient.post()
					.uri(OBJECT_PATH, bucket, key)
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
					.uri(OBJECT_PATH, bucket, key)
					.header(API_KEY_HEADER, secretKey)
					.retrieve()
					.toBodilessEntity();
		} catch (RestClientException exception) {
			// Supabase responde 400 con el código NoSuchKey a un archivo que no
			// existe: para quien borra, ya está borrado.
			if (exception instanceof HttpClientErrorException rejected
					&& rejected.getResponseBodyAsString().contains("\"NoSuchKey\"")) {
				return;
			}
			log.error("No se pudo borrar el archivo {} de Supabase Storage", key, exception);
			throw new StorageUnavailableException(exception);
		}
	}

	@Override
	public void download(String key, Path target) {
		requireConfiguration(key);
		try {
			restClient.get()
					.uri(OBJECT_PATH, bucket, key)
					.header(API_KEY_HEADER, secretKey)
					.exchange((request, response) -> {
						if (response.getStatusCode().isError()) {
							throw new RestClientResponseException("Supabase Storage rechazó la descarga",
									response.getStatusCode(), response.getStatusText(), response.getHeaders(), null, null);
						}
						Files.copy(response.getBody(), target, StandardCopyOption.REPLACE_EXISTING);
						return null;
					});
		} catch (RestClientException exception) {
			log.error("No se pudo descargar el archivo {} de Supabase Storage", key, exception);
			throw new StorageUnavailableException(exception);
		}
	}

	@Override
	public URI signedUrl(String key, Duration validity) {
		requireConfiguration(key);
		SignedUrl signed;
		try {
			signed = restClient.post()
					.uri("/sign/{bucket}/{key}", bucket, key)
					.header(API_KEY_HEADER, secretKey)
					.contentType(MediaType.APPLICATION_JSON)
					.body(Map.of("expiresIn", validity.toSeconds()))
					.retrieve()
					.body(SignedUrl.class);
		} catch (RestClientException exception) {
			log.error("No se pudo firmar un enlace al archivo {} en Supabase Storage", key, exception);
			throw new StorageUnavailableException(exception);
		}
		if (signed == null || signed.signedURL() == null) {
			log.error("Supabase Storage respondió sin el enlace firmado del archivo {}", key);
			throw new StorageUnavailableException(null);
		}
		// Supabase devuelve la ruta desde /storage/v1, con la firma en la consulta.
		return URI.create(storageUrl + signed.signedURL());
	}

	private record SignedUrl(String signedURL) {
	}

	// Sin configuración la aplicación arranca igual (CI y entornos locales), y
	// guardar, borrar, descargar o firmar responde como no disponible.
	private void requireConfiguration(String key) {
		if (!configured) {
			log.warn("Supabase Storage sin configurar (SUPABASE_*): no se procesa el archivo {}", key);
			throw new StorageUnavailableException(null);
		}
	}

}
