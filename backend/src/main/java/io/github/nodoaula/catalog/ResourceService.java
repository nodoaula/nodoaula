package io.github.nodoaula.catalog;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
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

	ResourceService(ResourceRepository resourceRepository, CourseRepository courseRepository,
			TopicRepository topicRepository, VideoMetadataProvider videoMetadataProvider, FileStorage fileStorage,
			TransactionTemplate transactionTemplate) {
		this.resourceRepository = resourceRepository;
		this.courseRepository = courseRepository;
		this.topicRepository = topicRepository;
		this.videoMetadataProvider = videoMetadataProvider;
		this.fileStorage = fileStorage;
		this.transactionTemplate = transactionTemplate;
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

	/** Devuelve la ficha de un recurso (historia HU108). */
	@Transactional(readOnly = true)
	public ResourceDetailDto getResource(Long id) {
		Resource resource = resourceRepository.findById(id)
				.orElseThrow(ResourceNotFoundException::new);

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
				topicNames(resource));
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
			DocumentFile file = new DocumentFile(UUID.randomUUID() + ".pdf", upload.getSize(),
					PdfDocuments.countPages(pdf));
			fileStorage.store(file.key(), pdf, MediaType.APPLICATION_PDF_VALUE);
			return saveDocumentOrDeleteFile(request, file, authorId);
		} finally {
			deleteTempFile(pdf);
		}
	}

	private ResourceDto saveDocumentOrDeleteFile(DocumentUploadRequest request, DocumentFile file, Long authorId) {
		try {
			return transactionTemplate.execute(status -> saveDocument(request, file, authorId));
		} catch (RuntimeException exception) {
			deleteStoredFile(file.key());
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

	// Busca primero y crea solo si hace falta, pero el hueco entre ambas
	// operaciones permite que dos registros simultáneos con el mismo curso
	// nuevo intenten crearlo a la vez; el segundo lo detiene la restricción
	// única de la tabla, y entonces se reutiliza el que ganó la carrera.
	private Course findOrCreateCourse(String name) {
		return courseRepository.findByName(name)
				.orElseGet(() -> {
					try {
						return courseRepository.saveAndFlush(new Course(name));
					} catch (DataIntegrityViolationException exception) {
						return courseRepository.findByName(name).orElseThrow(() -> exception);
					}
				});
	}

	// Misma carrera que findOrCreateCourse, pero por curso y nombre de tema.
	private Topic findOrCreateTopic(Course course, String name) {
		return topicRepository.findByCourseAndName(course, name)
				.orElseGet(() -> {
					try {
						return topicRepository.saveAndFlush(new Topic(course, name));
					} catch (DataIntegrityViolationException exception) {
						return topicRepository.findByCourseAndName(course, name).orElseThrow(() -> exception);
					}
				});
	}

	private static String blankToNull(String value) {
		return (value == null || value.isBlank()) ? null : value.strip();
	}

	private ResourceDto toDto(Resource resource) {
		return new ResourceDto(
				resource.getId(),
				resource.getTitle(),
				resource.getCourse().getName(),
				resource.getResourceType(),
				resource.getDurationSeconds(),
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
