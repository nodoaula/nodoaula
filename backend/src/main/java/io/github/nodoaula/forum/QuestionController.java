package io.github.nodoaula.forum;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Las preguntas del foro se leen sin sesión y se escriben con ella: los GET
 * son públicos en SecurityConfig y el resto lo cubre anyRequest().authenticated().
 */
@RestController
@RequestMapping("/api/forum/questions")
class QuestionController {

	private final QuestionService questionService;

	QuestionController(QuestionService questionService) {
		this.questionService = questionService;
	}

	@GetMapping
	List<QuestionDto> listQuestions(@RequestParam Long courseId,
			@AuthenticationPrincipal(expression = "#this instanceof T(String) ? null : id") Long viewerId) {
		return questionService.listQuestions(courseId, viewerId);
	}

	@GetMapping("/{id}")
	QuestionDto getQuestion(@PathVariable Long id,
			@AuthenticationPrincipal(expression = "#this instanceof T(String) ? null : id") Long viewerId) {
		return questionService.getQuestion(id, viewerId);
	}

	// El autor no llega en el cuerpo: se toma de la cuenta con sesión iniciada.
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	QuestionDto createQuestion(@Valid @RequestBody CreateQuestionRequest request,
			@AuthenticationPrincipal(expression = "id") Long authorId) {
		return questionService.createQuestion(request, authorId);
	}

	@PostMapping("/{id}/retire")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void retireQuestion(@PathVariable Long id, @AuthenticationPrincipal(expression = "id") Long accountId) {
		questionService.retireQuestion(id, accountId);
	}

	@PutMapping("/{id}/useful-answer")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void markUsefulAnswer(@PathVariable Long id, @Valid @RequestBody UsefulAnswerRequest request,
			@AuthenticationPrincipal(expression = "id") Long accountId) {
		questionService.markUsefulAnswer(id, request, accountId);
	}

	@DeleteMapping("/{id}/useful-answer")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void clearUsefulAnswer(@PathVariable Long id, @AuthenticationPrincipal(expression = "id") Long accountId) {
		questionService.clearUsefulAnswer(id, accountId);
	}

}
