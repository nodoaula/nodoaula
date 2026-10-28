package io.github.nodoaula.forum;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.account.AccountService;

/**
 * Las respuestas a las preguntas del foro (historia HU402). Interno del
 * módulo: ningún otro las usa. Sobre una pregunta retirada no se lee, ni se
 * responde, ni se retira nada.
 */
@Service
class AnswerService {

	private final AnswerRepository answerRepository;
	private final QuestionRepository questionRepository;
	private final AccountService accountService;

	AnswerService(AnswerRepository answerRepository, QuestionRepository questionRepository,
			AccountService accountService) {
		this.answerRepository = answerRepository;
		this.questionRepository = questionRepository;
		this.accountService = accountService;
	}

	/**
	 * El hilo de una pregunta, en orden cronológico. Público: `viewerId` es
	 * null sin sesión.
	 *
	 * @throws QuestionNotFoundException si la pregunta no existe o está retirada
	 */
	@Transactional(readOnly = true)
	public List<AnswerDto> listAnswers(Long questionId, Long viewerId) {
		if (!questionRepository.existsByIdAndRetiredAtIsNull(questionId)) {
			throw new QuestionNotFoundException();
		}
		boolean viewerIsTeam = viewerId != null && accountService.isTeamMember(viewerId);
		return answerRepository.findByQuestionIdAndRetiredAtIsNullOrderByCreatedAtAscIdAsc(questionId).stream()
				.map(answer -> toDto(answer, viewerId, viewerIsTeam))
				.toList();
	}

	/**
	 * Publica una respuesta, sin los espacios de los extremos.
	 *
	 * @throws QuestionNotFoundException si la pregunta no existe o está retirada
	 */
	@Transactional
	public AnswerDto createAnswer(Long questionId, CreateAnswerRequest request, Long authorId) {
		Question question = questionRepository.getVisibleForShare(questionId);
		Answer answer = answerRepository.save(new Answer(question.getId(), authorId, request.body().strip()));
		return toDto(answer, authorId, false);
	}

	/**
	 * Retira una respuesta: deja de verse, pero no se borra. La retira quien
	 * la publicó o una cuenta del equipo. Si era la útil, la pregunta se queda
	 * sin respuesta útil.
	 *
	 * @throws AnswerNotFoundException si no existe o ya estaba retirada
	 * @throws QuestionNotFoundException si su pregunta está retirada
	 * @throws AnswerChangeForbiddenException si quien pide no puede
	 */
	@Transactional
	public void retireAnswer(Long id, Long accountId) {
		Long questionId = answerRepository.findQuestionIdOfVisibleAnswer(id).orElseThrow(AnswerNotFoundException::new);
		Question question = questionRepository.getVisibleForUpdate(questionId);
		Answer answer = answerRepository.findForUpdateByIdAndRetiredAtIsNull(id)
				.orElseThrow(AnswerNotFoundException::new);
		if (!canRetire(answer, accountId, accountService.isTeamMember(accountId))) {
			throw new AnswerChangeForbiddenException();
		}
		answer.retire(accountId, Instant.now());
		if (answer.getId().equals(question.getUsefulAnswerId())) {
			question.clearUseful();
		}
	}

	private static boolean canRetire(Answer answer, Long viewerId, boolean viewerIsTeam) {
		return viewerId != null && (viewerIsTeam || viewerId.equals(answer.getAuthorId()));
	}

	private static AnswerDto toDto(Answer answer, Long viewerId, boolean viewerIsTeam) {
		return new AnswerDto(answer.getId(), answer.getBody(), answer.getCreatedAt(),
				answer.getAuthorId().equals(viewerId), canRetire(answer, viewerId, viewerIsTeam));
	}

}
