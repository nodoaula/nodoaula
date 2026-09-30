package io.github.nodoaula.catalog;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * El listado y la ficha deben seguir accesibles sin sesión iniciada: el catálogo se
 * consulta sin cuenta, y la sesión solo hace falta para aportar (ADR-007).
 * Registrar un recurso sí la exige, sin regla propia en SecurityConfig porque
 * ya la cubre anyRequest().authenticated().
 */
@RestController
@RequestMapping("/api/resources")
class ResourceController {

	private final ResourceService resourceService;

	ResourceController(ResourceService resourceService) {
		this.resourceService = resourceService;
	}

	// Los cuatro filtros son opcionales y se combinan con AND (historias
	// HU206 y HU207); curso, tema y tipo admiten además varios valores a la
	// vez (varios courseId/topicId/resourceType en la query string).
	@GetMapping
	List<ResourceDto> listResources(
			@RequestParam(required = false) List<Long> courseId,
			@RequestParam(required = false) List<Long> topicId,
			@RequestParam(required = false) List<ResourceType> resourceType,
			@RequestParam(required = false) String q) {
		return resourceService.listResources(courseId, topicId, resourceType, q);
	}

	@GetMapping("/courses")
	List<CourseDto> listCoursesWithResources() {
		return resourceService.listCoursesWithResources();
	}

	// Sin courseId lista los temas de todos los cursos (historia HU206); con
	// uno o varios courseId, solo los de esos cursos (uso original: sugerirlos
	// al registrar un recurso con un único curso, historia HU105).
	@GetMapping("/topics")
	List<TopicDto> listTopicsWithResources(@RequestParam(required = false) List<Long> courseId) {
		return resourceService.listTopicsWithResources(courseId);
	}

	// Las rutas literales /courses y /topics ganan a esta por ser más
	// específicas, así que ninguna se interpreta como identificador de recurso.
	@GetMapping("/{id}")
	ResourceDetailDto getResource(@PathVariable Long id) {
		return resourceService.getResource(id);
	}

	/**
	 * El id del autor no llega en el cuerpo: se toma de la cuenta con sesión
	 * iniciada. La expresión lee la propiedad por reflexión en vez de recibir
	 * el principal como parámetro, para no depender de su tipo, que es interno
	 * del módulo account (ADR-008).
	 */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	ResourceDto createResource(@Valid @RequestBody CreateResourceRequest request,
			@AuthenticationPrincipal(expression = "id") Long authorId) {
		return resourceService.createResource(request, authorId);
	}

}
