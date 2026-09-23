package io.github.nodoaula.catalog;

import java.util.List;

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
	 * Lista los recursos del catálogo, opcionalmente filtrados por curso.
	 * El filtro es una comparación exacta por identificador de curso, nunca una
	 * búsqueda de texto.
	 */
	@Transactional(readOnly = true)
	public List<ResourceDto> listResources(Long courseId) {
		List<Resource> resources = courseId != null
				? resourceRepository.findByCourseId(courseId)
				: resourceRepository.findAll();

		return resources.stream()
				.map(this::toDto)
				.toList();
	}

	/** Lista los cursos que tienen al menos un recurso, para poblar el selector de filtro. */
	@Transactional(readOnly = true)
	public List<CourseDto> listCoursesWithResources() {
		return courseRepository.findCoursesWithAtLeastOneResource().stream()
				.map(course -> new CourseDto(course.getId(), course.getName()))
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
				resource.getTitle(),
				resource.getCourse().getName(),
				resource.getResourceType(),
				resource.getDurationSeconds());
	}

}
