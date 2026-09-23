package io.github.nodoaula.catalog;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * El listado debe seguir accesible sin sesión iniciada: el catálogo se
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

	@GetMapping
	List<ResourceDto> listResources(@RequestParam(required = false) Long courseId) {
		return resourceService.listResources(courseId);
	}

	@GetMapping("/courses")
	List<CourseDto> listCoursesWithResources() {
		return resourceService.listCoursesWithResources();
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
