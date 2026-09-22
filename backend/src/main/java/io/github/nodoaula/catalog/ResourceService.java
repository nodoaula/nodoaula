package io.github.nodoaula.catalog;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Único punto público del módulo catalog, conforme al ADR-008. */
@Service
public class ResourceService {

	private final ResourceRepository resourceRepository;
	private final CourseRepository courseRepository;

	ResourceService(ResourceRepository resourceRepository, CourseRepository courseRepository) {
		this.resourceRepository = resourceRepository;
		this.courseRepository = courseRepository;
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

	private ResourceDto toDto(Resource resource) {
		return new ResourceDto(
				resource.getTitle(),
				resource.getCourse().getName(),
				resource.getResourceType(),
				resource.getDurationSeconds());
	}

}
