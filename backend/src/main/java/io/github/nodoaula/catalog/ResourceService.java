package io.github.nodoaula.catalog;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import io.github.nodoaula.account.AccountService;
import io.github.nodoaula.shared.error.FieldValidationException;
import io.github.nodoaula.shared.storage.FileStorage;
import io.github.nodoaula.shared.storage.StorageUnavailableException;

/** Único punto público del módulo catalog, conforme al ADR-008. */
@Service
public class ResourceService {

	private static final Logger log = LoggerFactory.getLogger(ResourceService.class);

	// Por debajo del giga del plan gratuito de Supabase: pasarlo restringe el
	// proyecto entero, base de datos incluida (HU301).
	static final long STORAGE_LIMIT_BYTES = 900L * 1024 * 1024;

	// La fecha de un apunte es el día en que se sube, en la zona de los
	// usuarios del proyecto.
	private static final ZoneId UPLOAD_ZONE = ZoneId.of("America/Bogota");

	private final ResourceRepository resourceRepository;
	private final CourseRepository courseRepository;
	private final TopicRepository topicRepository;
	private final VideoMetadataProvider videoMetadataProvider;
	private final FileStorage fileStorage;
	private final TransactionTemplate transactionTemplate;
	// Para saber si una cuenta es del equipo: se le pregunta al servicio de
	// account, nunca a su repositorio ni a su entidad (ADR-008).
	private final AccountService accountService;

	ResourceService(ResourceRepository resourceRepository, CourseRepository courseRepository,
			TopicRepository topicRepository, VideoMetadataProvider videoMetadataProvider, FileStorage fileStorage,
			TransactionTemplate transactionTemplate, AccountService accountService) {
		this.resourceRepository = resourceRepository;
		this.courseRepository = courseRepository;
		this.topicRepository = topicRepository;
		this.videoMetadataProvider = videoMetadataProvider;
		this.fileStorage = fileStorage;
		this.transactionTemplate = transactionTemplate;
		this.accountService = accountService;
	}

	/**
	 * Lista los recursos del catálogo, filtrados por curso, tema, tipo de
	 * recurso (historia HU206) y un texto de búsqueda libre sobre título,
	 * descripción y temas (historia HU207). Los cuatro filtros son opcionales
	 * y cada uno admite uno o varios valores a la vez: una lista vacía o en
	 * null (o, para tipo, una lista con ambos valores) no restringe nada.
	 * Entre los cuatro filtros se combinan con AND; dentro de cada uno, los
	 * valores elegidos se combinan con OR. Curso, tema y tipo son
	 * comparaciones exactas por identificador; la búsqueda de texto es
	 * insensible a mayúsculas y tildes.
	 */
	@Transactional(readOnly = true)
	public List<ResourceDto> listResources(
			List<Long> courseIds, List<Long> topicIds, List<ResourceType> resourceTypes, String query) {
		// Marcar ambos tipos, o ninguno, equivale a no filtrar por tipo.
		List<ResourceType> effectiveTypes = (resourceTypes == null || resourceTypes.isEmpty()
				|| resourceTypes.size() >= ResourceType.values().length)
				? null
				: resourceTypes;

		List<Resource> resources = resourceRepository.search(
				normalizeIds(courseIds), normalizeIds(topicIds), effectiveTypes);

		// La búsqueda de texto (historia HU207) se aplica en memoria y no en la
		// consulta: normalizar mayúsculas y tildes es más simple en Java que en
		// SQL portable, y el catálogo no es lo bastante grande para que importe.
		String normalizedQuery = normalize(query);
		if (normalizedQuery != null && !normalizedQuery.isBlank()) {
			resources = resources.stream().filter(resource -> matches(resource, normalizedQuery)).toList();
		}

		return resources.stream()
				.map(this::toDto)
				.toList();
	}

	// Compara título, descripción y temas: coincide si el texto buscado
	// aparece en cualquiera de los tres.
	private static boolean matches(Resource resource, String normalizedQuery) {
		if (contains(resource.getTitle(), normalizedQuery)) return true;
		if (contains(resource.getDescription(), normalizedQuery)) return true;
		return resource.getTopics().stream().anyMatch(topic -> contains(topic.getName(), normalizedQuery));
	}

	private static boolean contains(String value, String normalizedQuery) {
		String normalizedValue = normalize(value);
		return normalizedValue != null && normalizedValue.contains(normalizedQuery);
	}

	// Quita tildes (forma NFD: separa cada letra de su diacrítico, y \p{M}
	// borra el diacrítico) y pasa a minúsculas, para comparar sin distinguir
	// mayúsculas ni acentos.
	private static String normalize(String value) {
		if (value == null) return null;
		String withoutAccents = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
		return withoutAccents.toLowerCase(Locale.ROOT);
	}

	// Una lista vacía de ids equivale a no elegir ninguno, y eso significa "no
	// filtrar por este campo" (igual que con el tipo de recurso), no "no
	// mostrar nada".
	private static List<Long> normalizeIds(List<Long> ids) {
		return (ids == null || ids.isEmpty()) ? null : ids;
	}

	/**
	 * Devuelve la ficha de un recurso (historia HU108), con si quien la ve
	 * puede corregirlo (HU311), retirarlo o volver a publicarlo (HU307). La de
	 * un recurso retirado sale sin su contenido. {@code viewerId} es null sin
	 * sesión.
	 */
	@Transactional(readOnly = true)
	public ResourceDetailDto getResource(Long id, Long viewerId) {
		return toDetailDto(findResource(id), viewerId);
	}

	/**
	 * Corrige los datos de un recurso (historia HU311). Solo puede quien lo
	 * aportó o una cuenta del equipo (ADR-007). En un video se corrigen título,
	 * descripción, fecha, duración, canal, curso y temas; en un apunte, título,
	 * descripción, curso y temas, porque su fecha es la de la subida. El enlace,
	 * el archivo y la vía de ingreso no cambian. Curso y temas siguen las
	 * mismas reglas que al registrar: se reutilizan si ya existen, sin
	 * distinguir mayúsculas ni tildes, o se crean (HU308). Un recurso retirado
	 * no se corrige: primero se vuelve a publicar (HU307).
	 */
	@Transactional
	public ResourceDetailDto updateResource(Long id, UpdateResourceRequest request, Long editorId) {
		Resource resource = findResource(id);

		if (!canChange(resource, editorId)) {
			throw new ResourceChangeForbiddenException();
		}
		if (resource.isRetired()) {
			throw new ResourceRetiredException();
		}

		boolean isDocument = resource.getResourceType() == ResourceType.DOCUMENT;
		if (isDocument) {
			rejectFieldsOfAVideo(request);
		} else if (request.publishedAt() == null) {
			throw new FieldValidationException("publishedAt", "Elige la fecha de publicación.");
		}

		Course course = findOrCreateCourse(request.course().strip());
		resource.correct(
				request.title().strip(),
				blankToNull(request.description()),
				isDocument ? resource.getPublishedAt() : request.publishedAt(),
				request.durationSeconds(),
				blankToNull(request.channel()),
				course);
		addTopics(resource, course, request.topics());

		return toDetailDto(resource, editorId);
	}

	/**
	 * Retira un recurso del catálogo (historia HU307), con la misma regla de
	 * autoría que la corrección (ADR-007): quien lo aportó o una cuenta del
	 * equipo. El retiro es lógico: deja de listarse, pero la fila, sus temas y
	 * el archivo de un apunte se conservan. Se comprueba el permiso antes que
	 * el estado, para no contarle a quien no puede retirarlo si ya lo está.
	 */
	@Transactional
	public ResourceDetailDto retireResource(Long id, Long accountId) {
		Resource resource = findResource(id);

		if (!canChange(resource, accountId)) {
			throw new ResourceChangeForbiddenException();
		}
		if (resource.isRetired()) {
			throw new ResourceRetiredException();
		}

		resource.retire(accountId, Instant.now());
		return toDetailDto(resource, accountId);
	}

	/**
	 * Vuelve a publicar un recurso retirado (historia HU307), que reaparece
	 * donde estaba. Solo puede la cuenta que lo retiró, mientras conserve el
	 * permiso sobre él. Aquí el estado va antes que el permiso: en un recurso
	 * publicado no hay quien lo retirase, y un 403 ocultaría la causa real.
	 */
	@Transactional
	public ResourceDetailDto republishResource(Long id, Long accountId) {
		Resource resource = findResource(id);

		if (!resource.isRetired()) {
			throw new ResourceNotRetiredException();
		}
		if (!canRepublish(resource, accountId)) {
			throw new ResourceRepublishForbiddenException();
		}

		resource.republish();
		return toDetailDto(resource, accountId);
	}

	private Resource findResource(Long id) {
		return resourceRepository.findById(id).orElseThrow(ResourceNotFoundException::new);
	}

	// La fecha de un apunte es la de su subida, y un apunte no tiene duración
	// ni canal (HU311). Se rechazan en vez de ignorarse, para que nadie crea
	// que los cambió.
	private static void rejectFieldsOfAVideo(UpdateResourceRequest request) {
		if (request.publishedAt() != null) {
			throw new FieldValidationException("publishedAt",
					"La fecha de un apunte es la de su subida y no se cambia.");
		}
		if (request.durationSeconds() != null) {
			throw new FieldValidationException("durationSeconds", "Un apunte no tiene duración.");
		}
		if (blankToNull(request.channel()) != null) {
			throw new FieldValidationException("channel", "Un apunte no tiene canal.");
		}
	}

	/**
	 * Regla de autoría del ADR-007: un recurso lo modifica quien lo aportó o
	 * una cuenta del equipo. Los del catálogo semilla tienen author_id = 0, que
	 * no es de ninguna cuenta, así que solo los modifica el equipo.
	 */
	private boolean canChange(Resource resource, Long accountId) {
		if (accountId == null) return false;
		return accountId.equals(resource.getAuthorId()) || accountService.isTeamMember(accountId);
	}

	/**
	 * Un recurso retirado lo vuelve a publicar la cuenta que lo retiró, si
	 * conserva el permiso sobre él (HU307): una cuenta que deja de ser del
	 * equipo ya no devuelve lo que retiró de otros.
	 */
	private boolean canRepublish(Resource resource, Long accountId) {
		return resource.isRetired() && resource.getRetiredBy().equals(accountId) && canChange(resource, accountId);
	}

	/**
	 * Si el curso existe. Lo pregunta el foro al publicar una pregunta: la
	 * entidad del curso no sale de este módulo (ADR-008).
	 */
	@Transactional(readOnly = true)
	public boolean courseExists(Long courseId) {
		return courseRepository.existsById(courseId);
	}

	/**
	 * Si el recurso está publicado, no retirado, y es del curso. Lo pregunta el
	 * foro para que una pregunta sobre un recurso apunte a uno que se ve.
	 */
	@Transactional(readOnly = true)
	public boolean isPublishedResourceOfCourse(Long resourceId, Long courseId) {
		return resourceRepository.findById(resourceId)
				.filter(resource -> !resource.isRetired() && resource.getCourse().getId().equals(courseId))
				.isPresent();
	}

	/** Lista los cursos que tienen al menos un recurso. */
	@Transactional(readOnly = true)
	public List<CourseDto> listCoursesWithResources() {
		return courseRepository.findCoursesWithAtLeastOneResource().stream()
				.map(course -> new CourseDto(course.getId(), course.getName()))
				.toList();
	}

	/**
	 * Lista los temas con al menos un recurso, para poblar el selector de
	 * temas del catálogo (HU206) y las sugerencias al registrar un recurso
	 * (HU105, con un único curso). Sin cursos elegidos lista los de todos.
	 */
	@Transactional(readOnly = true)
	public List<TopicDto> listTopicsWithResources(List<Long> courseIds) {
		return topicRepository.findTopicsWithAtLeastOneResource(normalizeIds(courseIds)).stream()
				.map(topic -> new TopicDto(topic.getId(), topic.getName()))
				.toList();
	}

	/**
	 * Consulta en YouTube los datos de un video para autocompletar el
	 * formulario de registro (historia HU202). No persiste nada: el recurso
	 * solo se crea al publicar, con createResource, que exige curso y temas.
	 * Sin transacción, porque no toca la base y no debe retener una conexión
	 * mientras espera a YouTube.
	 */
	public VideoMetadataDto getYouTubeMetadata(String link) {
		String videoId = YouTubeVideoIds.extract(link).orElseThrow(InvalidVideoLinkException::new);
		VideoMetadata metadata = videoMetadataProvider.fetch(videoId);

		List<String> missingFields = new ArrayList<>();
		if (metadata.title() == null) missingFields.add("title");
		if (metadata.description() == null) missingFields.add("description");
		if (metadata.publishedAt() == null) missingFields.add("publishedAt");
		if (metadata.durationSeconds() == null) missingFields.add("durationSeconds");
		if (metadata.channel() == null) missingFields.add("channel");

		return new VideoMetadataDto(
				videoId,
				YouTubeVideoIds.canonicalUrl(videoId),
				metadata.title(),
				metadata.description(),
				metadata.publishedAt(),
				metadata.durationSeconds(),
				metadata.channel(),
				List.copyOf(missingFields));
	}

	/**
	 * Registra un recurso (historias HU105 y HU202). El curso y cada tema se
	 * reutilizan si ya existen en el vocabulario controlado, o se crean en la
	 * misma operación si no (AB#93). Sin vía de ingreso se toma la manual, de
	 * modo que los clientes que no la envían no cambian.
	 */
	@Transactional
	public ResourceDto createResource(CreateResourceRequest request, Long authorId) {
		EntryMethod entryMethod = request.entryMethod() == null ? EntryMethod.MANUAL : request.entryMethod();

		if (request.resourceType() == ResourceType.DOCUMENT) {
			throw new FieldValidationException("resourceType",
					"Un apunte se registra subiendo su archivo, no con un enlace.");
		}

		// Solo un video de YouTube puede haberse indexado automáticamente.
		if (entryMethod == EntryMethod.AUTOMATIC && YouTubeVideoIds.extract(request.url()).isEmpty()) {
			throw new FieldValidationException("entryMethod",
					"Solo un recurso con enlace de YouTube puede registrarse como indexado automáticamente.");
		}

		// Un mismo video no se registra dos veces (HU308). Se comprueba antes de
		// crear el curso y los temas para no dejar nada a medias. Uno retirado
		// también cuenta: su fila sigue ahí y se vuelve a publicar (HU307).
		YouTubeVideoIds.extract(request.url()).ifPresent(videoId -> {
			if (resourceRepository.existsByVideoId(videoId)) throw new VideoAlreadyRegisteredException();
		});

		Course course = findOrCreateCourse(request.course().strip());

		Resource resource = new Resource(
				request.title().strip(),
				blankToNull(request.description()),
				request.publishedAt(),
				request.durationSeconds(),
				blankToNull(request.channel()),
				request.url().strip(),
				request.resourceType(),
				course,
				authorId,
				entryMethod);

		addTopics(resource, course, request.topics());
		resourceRepository.save(resource);

		return toDto(resource);
	}

	/**
	 * Sube un apunte y lo registra (historia HU302). El archivo se guarda antes
	 * que el registro y fuera de la transacción, para no retener una conexión
	 * de la base mientras se sube; si después el registro falla, se borra.
	 */
	public ResourceDto createDocument(DocumentUploadRequest request, Long authorId) {
		MultipartFile upload = request.file();
		if (resourceRepository.totalStoredBytes() + upload.getSize() > STORAGE_LIMIT_BYTES) {
			throw new DocumentStorageFullException();
		}

		// PDFBox necesita leer el archivo desde el disco, y el almacenamiento lo
		// sube desde esa misma copia.
		Path pdf = copyToTempFile(upload);
		try {
			int pageCount = PdfDocuments.countPages(pdf);
			String sha256 = sha256Of(pdf);
			if (resourceRepository.existsByFileSha256(sha256)) {
				throw new DocumentAlreadyUploadedException();
			}
			DocumentFile file = new DocumentFile(UUID.randomUUID() + ".pdf", upload.getSize(), pageCount, sha256);
			storeOrDeleteFile(file.key(), pdf);
			return saveDocumentOrDeleteFile(request, file, authorId);
		} finally {
			deleteTempFile(pdf);
		}
	}

	// Que la subida falle al esperar la respuesta no prueba que el archivo no
	// se guardara: se intenta borrar para no dejarlo sin registro.
	private void storeOrDeleteFile(String key, Path pdf) {
		try {
			fileStorage.store(key, pdf, MediaType.APPLICATION_PDF_VALUE);
		} catch (StorageUnavailableException exception) {
			deleteStoredFile(key);
			throw exception;
		}
	}

	private ResourceDto saveDocumentOrDeleteFile(DocumentUploadRequest request, DocumentFile file, Long authorId) {
		try {
			return transactionTemplate.execute(status -> saveDocument(request, file, authorId));
		} catch (RuntimeException exception) {
			deleteStoredFile(file.key());
			// Dos subidas simultáneas del mismo archivo pasan la comprobación
			// previa: la segunda la detiene la restricción única de la tabla.
			if (exception instanceof DataIntegrityViolationException
					&& resourceRepository.existsByFileSha256(file.sha256())) {
				throw new DocumentAlreadyUploadedException();
			}
			throw exception;
		}
	}

	private ResourceDto saveDocument(DocumentUploadRequest request, DocumentFile file, Long authorId) {
		Course course = findOrCreateCourse(request.course().strip());

		Resource resource = Resource.document(
				request.title().strip(),
				blankToNull(request.description()),
				LocalDate.now(UPLOAD_ZONE),
				course,
				authorId,
				file);

		addTopics(resource, course, request.topics());
		resourceRepository.save(resource);

		return toDto(resource);
	}

	// Un fallo al borrar no debe tapar el error del registro, que es el que
	// recibe el usuario: el archivo queda sin registro y el log lo dice.
	private void deleteStoredFile(String key) {
		try {
			fileStorage.delete(key);
		} catch (StorageUnavailableException exception) {
			log.error("El archivo {} quedó en el almacenamiento sin un recurso que lo registre", key, exception);
		}
	}

	private static Path copyToTempFile(MultipartFile upload) {
		Path pdf;
		try {
			pdf = Files.createTempFile("apunte-", ".pdf");
		} catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
		try {
			upload.transferTo(pdf);
			return pdf;
		} catch (IOException exception) {
			deleteTempFile(pdf);
			throw new UncheckedIOException(exception);
		}
	}

	private static String sha256Of(Path file) {
		try (InputStream in = Files.newInputStream(file)) {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] buffer = new byte[8192];
			for (int read = in.read(buffer); read != -1; read = in.read(buffer)) {
				digest.update(buffer, 0, read);
			}
			return HexFormat.of().formatHex(digest.digest());
		} catch (IOException exception) {
			throw new UncheckedIOException(exception);
		} catch (NoSuchAlgorithmException exception) {
			// SHA-256 viene en todas las JVM: no puede faltar.
			throw new IllegalStateException(exception);
		}
	}

	private static void deleteTempFile(Path pdf) {
		try {
			Files.deleteIfExists(pdf);
		} catch (IOException exception) {
			log.warn("No se pudo borrar el temporal {}", pdf, exception);
		}
	}

	// distinct() para que escribir el mismo tema dos veces en el formulario
	// no intente insertarlo dos veces en la tabla intermedia.
	private void addTopics(Resource resource, Course course, List<String> topics) {
		topics.stream()
				.map(String::strip)
				.distinct()
				.map(name -> findOrCreateTopic(course, name))
				.forEach(resource::addTopic);
	}

	// Busca primero y crea solo si hace falta. Si dos registros simultáneos
	// crean el mismo curso nuevo, el insert del segundo no hace nada (on
	// conflict do nothing) y la búsqueda posterior encuentra el del primero:
	// el duplicado nunca lanza excepción (AB#213). Dos nombres que solo se
	// diferencian en mayúsculas o tildes son el mismo curso (HU308).
	private Course findOrCreateCourse(String name) {
		String normalizedName = NameNormalizer.normalize(name);
		return courseRepository.findByNormalizedName(normalizedName)
				.orElseGet(() -> {
					courseRepository.insertIfAbsent(name, normalizedName);
					return courseRepository.findByNormalizedName(normalizedName).orElseThrow();
				});
	}

	// Misma lógica que findOrCreateCourse, por curso y nombre de tema.
	private Topic findOrCreateTopic(Course course, String name) {
		String normalizedName = NameNormalizer.normalize(name);
		return topicRepository.findByCourseAndNormalizedName(course, normalizedName)
				.orElseGet(() -> {
					topicRepository.insertIfAbsent(course.getId(), name, normalizedName);
					return topicRepository.findByCourseAndNormalizedName(course, normalizedName).orElseThrow();
				});
	}

	private static String blankToNull(String value) {
		return (value == null || value.isBlank()) ? null : value.strip();
	}

	// Los permisos son los de quien ve la ficha. Corregir y retirar siguen la
	// misma regla, y ninguno de los dos aplica a un recurso retirado.
	private ResourceDetailDto toDetailDto(Resource resource, Long viewerId) {
		if (resource.isRetired()) {
			return retiredDetailDto(resource, canRepublish(resource, viewerId));
		}

		boolean canChange = canChange(resource, viewerId);
		DocumentFile file = resource.getFile();
		return new ResourceDetailDto(
				resource.getId(),
				resource.getTitle(),
				resource.getDescription(),
				resource.getPublishedAt(),
				resource.getDurationSeconds(),
				resource.getChannel(),
				resource.getUrl(),
				resource.getResourceType(),
				resource.getCourse().getId(),
				resource.getCourse().getName(),
				topicNames(resource),
				canChange,
				false,
				canChange,
				false,
				file == null ? null : file.pageCount(),
				file == null ? null : file.sizeBytes());
	}

	// Sin su contenido: lo retirado por moderación no sigue a la vista por
	// enlace directo. El título solo lo recibe quien puede volver a
	// publicarlo, para que sepa cuál es.
	private static ResourceDetailDto retiredDetailDto(Resource resource, boolean canRepublish) {
		return new ResourceDetailDto(
				resource.getId(),
				canRepublish ? resource.getTitle() : null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				List.of(),
				false,
				true,
				false,
				canRepublish,
				null,
				null);
	}

	private ResourceDto toDto(Resource resource) {
		return new ResourceDto(
				resource.getId(),
				resource.getTitle(),
				resource.getCourse().getName(),
				resource.getResourceType(),
				resource.getDurationSeconds(),
				resource.getFile() == null ? null : resource.getFile().pageCount(),
				resource.getUrl(),
				topicNames(resource));
	}

	// Ordenados por nombre: la tabla intermedia no guarda ningún orden, y sin
	// esto el listado y la ficha podrían mostrarlos distinto en cada visita.
	private static List<String> topicNames(Resource resource) {
		return resource.getTopics().stream()
				.map(Topic::getName)
				.sorted()
				.toList();
	}

}
