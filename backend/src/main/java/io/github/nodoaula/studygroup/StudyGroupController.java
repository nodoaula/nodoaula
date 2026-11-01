package io.github.nodoaula.studygroup;

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
 * Los grupos de estudio se listan sin sesión y se crean y retiran con ella,
 * como las preguntas del foro: el GET es público en SecurityConfig y el resto
 * lo cubre anyRequest().authenticated().
 */
@RestController
@RequestMapping("/api/study-groups")
class StudyGroupController {

	private final StudyGroupService studyGroupService;

	StudyGroupController(StudyGroupService studyGroupService) {
		this.studyGroupService = studyGroupService;
	}

	@GetMapping
	List<StudyGroupDto> listGroups(@RequestParam Long courseId,
			@AuthenticationPrincipal(expression = "#this instanceof T(String) ? null : id") Long viewerId) {
		return studyGroupService.listGroups(courseId, viewerId);
	}

	// Quien lo crea no llega en el cuerpo: se toma de la cuenta con sesión.
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	StudyGroupDto createGroup(@Valid @RequestBody CreateStudyGroupRequest request,
			@AuthenticationPrincipal(expression = "id") Long creatorId) {
		return studyGroupService.createGroup(request, creatorId);
	}

	@PostMapping("/{id}/retire")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void retireGroup(@PathVariable Long id, @AuthenticationPrincipal(expression = "id") Long accountId) {
		studyGroupService.retireGroup(id, accountId);
	}

}
