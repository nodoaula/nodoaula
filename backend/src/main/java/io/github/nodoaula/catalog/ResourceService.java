package io.github.nodoaula.catalog;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Único punto público del módulo catalog, conforme al ADR-008. */
@Service
public class ResourceService {

	private final ResourceRepository resourceRepository;
	private final CourseRepository courseRepository;
	private final TopicRepository topicRepository;

	ResourceService(ResourceRepository resourceRepository, CourseRepository courseRepository,
			TopicRepository topicRepository) {
		this.resourceRepository = resourceRepository;
		this.courseRepository = courseRepository;
		this.topicRepository = topicRepository;
	}

	/**
	 * Lista los recursos del catálogo, filtrados por curso, tema, tipo de
	 * recurso (historia HU206) y un texto de búsqueda libre sobre título,
	 * descripción y temas (historia HU207). Los cuatro filtros son opcionales
	 * y se combinan entre sí con AND: cada uno en null (o la lista de tipos
	 * vacía o con ambos tipos) no restringe nada. Curso, tema y tipo son
	 * comparaciones exactas por identificador; la búsqueda de texto es
	 * insensible a mayúsculas y tildes.
	 */
	@Transactional(readOnly = true)
	public List<ResourceDto> listResources(Long courseId, Long topicId, List<ResourceType> resourceTypes, String query) {
		// Marcar ambos tipos, o ninguno, equivale a no filtrar por tipo.
		List<ResourceType> effectiveTypes = (resourceTypes == null || resourceTypes.isEmpty()
				|| resourceTypes.size() >= ResourceType.values().length)
				? null
				: resourceTypes;

		List<Resource> resources = resourceRepository.search(courseId, topicId, effectiveTypes);

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

	/**
	 * Devuelve la ficha de un recurso (historia HU108). Los temas salen
	 * ordenados por nombre: la tabla intermedia no guarda ningún orden, y sin
	 * esto la ficha podría mostrarlos distinto en cada visita.
	 */
	@Transactional(readOnly = true)
	public ResourceDetailDto getResource(Long id) {
		Resource resource = resourceRepository.findById(id)
				.orElseThrow(ResourceNotFoundException::new);

		List<String> topics = resource.getTopics().stream()
				.map(Topic::getName)
				.sorted()
				.toList();

		return new ResourceDetailDto(
				resource.getId(),
				resource.getTitle(),
				resource.getDescription(),
				resource.getPublishedAt(),
				resource.getDurationSeconds(),
				resource.getChannel(),
				resource.getUrl(),
				resource.getResourceType(),
				resource.getCourse().getName(),
				topics);
	}

	/** Lista los cursos que tienen al menos un recurso, para poblar el selector de filtro. */
	@Transactional(readOnly = true)
	public List<CourseDto> listCoursesWithResources() {
		return courseRepository.findCoursesWithAtLeastOneResource().stream()
				.map(course -> new CourseDto(course.getId(), course.getName()))
				.toList();
	}

	/**
	 * Lista los temas con al menos un recurso, para poblar el selector de
	 * temas del catálogo (HU206) y las sugerencias al registrar un recurso
	 * (HU105). Sin courseId lista los de todos los cursos.
	 */
	@Transactional(readOnly = true)
	public List<TopicDto> listTopicsWithResources(Long courseId) {
		return topicRepository.findTopicsWithAtLeastOneResource(courseId).stream()
				.map(topic -> new TopicDto(topic.getId(), topic.getName()))
				.toList();
	}

	/**
	 * Registra un recurso manualmente (historia HU105). El curso y cada tema se
	 * reutilizan si ya existen en el vocabulario controlado, o se crean en la
	 * misma operación si no (AB#93).
	 */
	@Transactional
	public ResourceDto createResource(CreateResourceRequest request, Long authorId) {
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
				authorId);

		// distinct() para que escribir el mismo tema dos veces en el formulario
		// no intente insertarlo dos veces en la tabla intermedia.
		request.topics().stream()
				.map(String::strip)
				.distinct()
				.map(name -> findOrCreateTopic(course, name))
				.forEach(resource::addTopic);

		resourceRepository.save(resource);

		return toDto(resource);
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
				resource.getDurationSeconds());
	}

}
