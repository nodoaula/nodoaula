package io.github.nodoaula.forum;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Las respuestas se leen sin sesión y se escriben con ella, como las
 * preguntas: el GET lo cubre la regla pública del foro en SecurityConfig.
 */
@RestController
@RequestMapping("/api/forum")
class AnswerController {

	private final AnswerService answerService;

	AnswerController(AnswerService answerService) {
		this.answerService = answerService;
	}

	@GetMapping("/questions/{questionId}/answers")
	List<AnswerDto> listAnswers(@PathVariable Long questionId,
			@AuthenticationPrincipal(expression = "#this instanceof T(String) ? null : id") Long viewerId) {
		return answerService.listAnswers(questionId, viewerId);
	}

	@PostMapping("/questions/{questionId}/answers")
	@ResponseStatus(HttpStatus.CREATED)
	AnswerDto createAnswer(@PathVariable Long questionId, @Valid @RequestBody CreateAnswerRequest request,
			@AuthenticationPrincipal(expression = "id") Long authorId) {
		return answerService.createAnswer(questionId, request, authorId);
	}

	@PostMapping("/answers/{id}/retire")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void retireAnswer(@PathVariable Long id, @AuthenticationPrincipal(expression = "id") Long accountId) {
		answerService.retireAnswer(id, accountId);
	}

}
