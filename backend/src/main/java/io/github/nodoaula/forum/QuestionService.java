package io.github.nodoaula.forum;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.account.AccountService;
import io.github.nodoaula.catalog.ResourceService;
import io.github.nodoaula.shared.error.FieldValidationException;

/**
 * Único punto público del módulo forum, conforme al ADR-008. Del catálogo
 * pregunta si un curso o un recurso existen y de account si una cuenta es del
 * equipo, siempre a través de sus servicios.
 */
@Service
public class QuestionService {

	private final QuestionRepository questionRepository;
	private final AnswerRepository answerRepository;
	private final ResourceService resourceService;
	private final AccountService accountService;

	QuestionService(QuestionRepository questionRepository, AnswerRepository answerRepository,
			ResourceService resourceService, AccountService accountService) {
		this.questionRepository = questionRepository;
		this.answerRepository = answerRepository;
		this.resourceService = resourceService;
		this.accountService = accountService;
	}

	/**
	 * Las preguntas visibles de un curso, de la más reciente a la más antigua.
	 * Pública: sin sesión el foro se lee. `viewerId` es null sin sesión.
	 */
	@Transactional(readOnly = true)
	public List<QuestionDto> listQuestions(Long courseId, Long viewerId) {
		boolean viewerIsTeam = viewerId != null && accountService.isTeamMember(viewerId);
		return questionRepository.findByCourseIdAndRetiredAtIsNullOrderByCreatedAtDescIdDesc(courseId).stream()
				.map(question -> toDto(question, viewerId, viewerIsTeam))
				.toList();
	}

	/**
	 * Una pregunta. De una retirada no se muestra el contenido, solo el curso,
	 * para que su página enlace al foro donde estaba.
	 *
	 * @throws QuestionNotFoundException si no existe
	 */
	@Transactional(readOnly = true)
	public QuestionDto getQuestion(Long id, Long viewerId) {
		Question question = questionRepository.findById(id).orElseThrow(QuestionNotFoundException::new);
		if (question.isRetired()) {
			return new QuestionDto(question.getId(), question.getCourseId(), null, null, null, null, null, true, false,
					false);
		}
		boolean viewerIsTeam = viewerId != null && accountService.isTeamMember(viewerId);
		return toDto(question, viewerId, viewerIsTeam);
	}

	/**
	 * Publica una pregunta de un curso, y opcionalmente de uno de sus
	 * recursos. El texto se guarda sin los espacios de los extremos.
	 *
	 * @throws FieldValidationException si el curso no existe, o el recurso no
	 *         está publicado en ese curso
	 */
	@Transactional
	public QuestionDto createQuestion(CreateQuestionRequest request, Long authorId) {
		if (!resourceService.courseExists(request.courseId())) {
			throw new FieldValidationException("courseId", "Elige un curso del catálogo.");
		}
		if (request.resourceId() != null
				&& !resourceService.isPublishedResourceOfCourse(request.resourceId(), request.courseId())) {
			throw new FieldValidationException("resourceId", "El recurso no está publicado en ese curso.");
		}

		Question question = questionRepository.save(new Question(request.courseId(), request.resourceId(), authorId,
				request.title().strip(), request.body().strip()));
		return toDto(question, authorId, false);
	}

	/**
	 * Retira una pregunta: deja de verse, con sus respuestas, pero no se
	 * borra. La retira quien la publicó o una cuenta del equipo.
	 *
	 * @throws QuestionNotFoundException si no existe o ya estaba retirada
	 * @throws QuestionChangeForbiddenException si quien pide no puede
	 */
	@Transactional
	public void retireQuestion(Long id, Long accountId) {
		Question question = questionRepository.getVisibleForUpdate(id);
		if (!canRetire(question, accountId, accountService.isTeamMember(accountId))) {
			throw new QuestionChangeForbiddenException();
		}
		question.retire(accountId, Instant.now());
	}

	/**
	 * Marca la respuesta útil de una pregunta, en lugar de la que hubiera. Solo
	 * quien hizo la pregunta, y con una respuesta visible de esa pregunta.
	 *
	 * @throws QuestionNotFoundException si la pregunta no existe o está retirada
	 * @throws UsefulAnswerForbiddenException si quien pide no hizo la pregunta
	 * @throws FieldValidationException si la respuesta no está publicada en ella
	 */
	@Transactional
	public void markUsefulAnswer(Long questionId, UsefulAnswerRequest request, Long accountId) {
		Question question = askedBy(questionId, accountId);
		Answer answer = answerRepository.findByIdAndQuestionIdAndRetiredAtIsNull(request.answerId(), questionId)
				.orElseThrow(() -> new FieldValidationException("answerId",
						"La respuesta no está publicada en esta pregunta."));
		question.markUseful(answer);
	}

	/**
	 * Quita la marca de respuesta útil, si la hay. Solo quien hizo la pregunta.
	 *
	 * @throws QuestionNotFoundException si la pregunta no existe o está retirada
	 * @throws UsefulAnswerForbiddenException si quien pide no hizo la pregunta
	 */
	@Transactional
	public void clearUsefulAnswer(Long questionId, Long accountId) {
		askedBy(questionId, accountId).clearUseful();
	}

	private Question askedBy(Long questionId, Long accountId) {
		Question question = questionRepository.getVisibleForUpdate(questionId);
		if (!question.getAuthorId().equals(accountId)) {
			throw new UsefulAnswerForbiddenException();
		}
		return question;
	}

	private static boolean canRetire(Question question, Long viewerId, boolean viewerIsTeam) {
		return viewerId != null && (viewerIsTeam || viewerId.equals(question.getAuthorId()));
	}

	private static QuestionDto toDto(Question question, Long viewerId, boolean viewerIsTeam) {
		return new QuestionDto(question.getId(), question.getCourseId(), question.getResourceId(),
				question.getTitle(), question.getBody(), question.getCreatedAt(), question.getUsefulAnswerId(), false,
				canRetire(question, viewerId, viewerIsTeam), question.getAuthorId().equals(viewerId));
	}

}
