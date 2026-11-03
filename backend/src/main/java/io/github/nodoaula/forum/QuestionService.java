package io.github.nodoaula.forum;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.account.AccountService;
import io.github.nodoaula.catalog.ResourceService;
import io.github.nodoaula.shared.error.FieldValidationException;

/**
 * Único punto público del módulo forum, conforme al ADR-008. Del catálogo
 * pregunta si un curso o un recurso existen y de account si una cuenta es del
 * equipo, siempre a través de sus servicios. Quién es miembro del grupo de un
 * hilo lo responde GroupThreadMembership, que implementa studygroup.
 */
@Service
public class QuestionService {

	private final QuestionRepository questionRepository;
	private final AnswerRepository answerRepository;
	private final ResourceService resourceService;
	private final AccountService accountService;
	private final GroupThreadMembership groupThreadMembership;

	QuestionService(QuestionRepository questionRepository, AnswerRepository answerRepository,
			ResourceService resourceService, AccountService accountService,
			GroupThreadMembership groupThreadMembership) {
		this.questionRepository = questionRepository;
		this.answerRepository = answerRepository;
		this.resourceService = resourceService;
		this.accountService = accountService;
		this.groupThreadMembership = groupThreadMembership;
	}

	/**
	 * Las preguntas visibles de un curso, de la más reciente a la más antigua.
	 * Pública: sin sesión el foro se lee. `viewerId` es null sin sesión.
	 */
	@Transactional(readOnly = true)
	public List<QuestionDto> listQuestions(Long courseId, Long viewerId) {
		boolean viewerIsTeam = viewerId != null && accountService.isTeamMember(viewerId);
		List<Question> questions = questionRepository
				.findByCourseIdAndRetiredAtIsNullOrderByCreatedAtDescIdDesc(courseId);
		Map<Long, Long> answerCounts = countAnswers(questions);
		Set<Long> memberThreads = groupThreadsOfMember(questions, viewerId);
		return questions.stream()
				.map(question -> toDto(question, answerCounts.getOrDefault(question.getId(), 0L), viewerId,
						viewerIsTeam, memberThreads))
				.toList();
	}

	// Una sola consulta para todos los hilos de grupo de la lista, no una por hilo.
	private Set<Long> groupThreadsOfMember(Collection<Question> questions, Long viewerId) {
		if (viewerId == null) {
			return Set.of();
		}
		List<Long> groupThreads = questions.stream().filter(Question::isGroupThread).map(Question::getId).toList();
		return groupThreads.isEmpty() ? Set.of() : groupThreadMembership.threadsWithMember(groupThreads, viewerId);
	}

	private Map<Long, Long> countAnswers(List<Question> questions) {
		if (questions.isEmpty()) {
			return Map.of();
		}
		return answerRepository.countVisibleByQuestionIds(questions.stream().map(Question::getId).toList()).stream()
				.collect(Collectors.toMap(AnswerRepository.AnswerCount::getQuestionId,
						AnswerRepository.AnswerCount::getAnswers));
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
			return new QuestionDto(question.getId(), question.getCourseId(), null, null, null, null, null, 0, true,
					false, false, false, false);
		}
		boolean viewerIsTeam = viewerId != null && accountService.isTeamMember(viewerId);
		return toDto(question, answerRepository.countByQuestionIdAndRetiredAtIsNull(id), viewerId, viewerIsTeam,
				groupThreadsOfMember(List.of(question), viewerId));
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
		return toDto(question, 0, authorId, false, Set.of());
	}

	/**
	 * Crea el hilo de un grupo de estudio en el foro de su curso (HU404), con
	 * el nombre y la descripción del grupo, y devuelve su identificador. Lo
	 * llama studygroup dentro de la transacción en que crea el grupo, después
	 * de comprobar el curso y el texto: si el grupo no se guarda, el hilo
	 * tampoco.
	 *
	 * @param description la descripción ya sin espacios en los extremos, o
	 *        vacía si el grupo no tiene
	 */
	@Transactional
	public Long createGroupThread(Long courseId, String name, String description, Long creatorId) {
		return questionRepository.save(Question.groupThread(courseId, creatorId, name, description)).getId();
	}

	/**
	 * Retira el hilo de un grupo al retirar el grupo (HU404). Quién puede
	 * hacerlo lo decide studygroup, que es el que conoce al creador del grupo.
	 * Si el hilo ya no se ve, no hace nada.
	 */
	@Transactional
	public void retireGroupThread(Long threadId, Long accountId) {
		questionRepository.findForUpdateByIdAndRetiredAtIsNull(threadId)
				.filter(Question::isGroupThread)
				.ifPresent(thread -> thread.retire(accountId, Instant.now()));
	}

	/**
	 * Retira una pregunta: deja de verse, con sus respuestas, pero no se
	 * borra. La retira quien la publicó o una cuenta del equipo.
	 *
	 * @throws QuestionNotFoundException si no existe o ya estaba retirada
	 * @throws GroupThreadChangeForbiddenException si es el hilo de un grupo
	 * @throws QuestionChangeForbiddenException si quien pide no puede
	 */
	@Transactional
	public void retireQuestion(Long id, Long accountId) {
		Question question = questionRepository.getVisibleForUpdate(id);
		if (question.isGroupThread()) {
			throw new GroupThreadChangeForbiddenException();
		}
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

	// El hilo de un grupo no se retira desde el foro, sino con el grupo.
	private static boolean canRetire(Question question, Long viewerId, boolean viewerIsTeam) {
		return !question.isGroupThread() && viewerId != null
				&& (viewerIsTeam || viewerId.equals(question.getAuthorId()));
	}

	private static boolean canAnswer(Question question, Long viewerId, Set<Long> memberThreads) {
		return viewerId != null && (!question.isGroupThread() || memberThreads.contains(question.getId()));
	}

	/** @param memberThreads los hilos de grupo de cuyo grupo es miembro quien mira */
	private static QuestionDto toDto(Question question, long answerCount, Long viewerId, boolean viewerIsTeam,
			Set<Long> memberThreads) {
		return new QuestionDto(question.getId(), question.getCourseId(), question.getResourceId(),
				question.getTitle(), question.getBody(), question.getCreatedAt(), question.getUsefulAnswerId(),
				answerCount, false, canRetire(question, viewerId, viewerIsTeam),
				question.getAuthorId().equals(viewerId), question.isGroupThread(),
				canAnswer(question, viewerId, memberThreads));
	}

}
