package io.github.nodoaula.catalog;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Debe seguir accesible sin sesión iniciada: el catálogo se consulta sin
 * cuenta, y la sesión solo hace falta para aportar (ADR-007).
 */
@RestController
@RequestMapping("/api/resources")
class ResourceController {

	private final ResourceService resourceService;

	ResourceController(ResourceService resourceService) {
		this.resourceService = resourceService;
	}

	@GetMapping
	List<ResourceDto> listResources(@RequestParam(required = false) Long courseId) {
		return resourceService.listResources(courseId);
	}

	@GetMapping("/courses")
	List<CourseDto> listCoursesWithResources() {
		return resourceService.listCoursesWithResources();
	}

}
