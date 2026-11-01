package io.github.nodoaula.studygroup;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.account.AccountService;
import io.github.nodoaula.catalog.ResourceService;
import io.github.nodoaula.forum.QuestionService;
import io.github.nodoaula.shared.error.FieldValidationException;

/**
 * Único punto público del módulo studygroup, conforme al ADR-008. Del catálogo
 * pregunta si un curso existe y cómo se comparan los nombres, de account si
 * una cuenta es del equipo, y al foro le pide crear y retirar el hilo de cada
 * grupo, siempre a través de sus servicios.
 */
@Service
public class StudyGroupService {

	// El índice único parcial de la migración V202610312331.
	private static final String UNIQUE_NAME_CONSTRAINT = "study_groups_course_id_normalized_name_key";

	private final StudyGroupRepository groupRepository;
	private final MembershipRepository membershipRepository;
	private final ResourceService resourceService;
	private final AccountService accountService;
	private final QuestionService questionService;

	StudyGroupService(StudyGroupRepository groupRepository, MembershipRepository membershipRepository,
			ResourceService resourceService, AccountService accountService, QuestionService questionService) {
		this.groupRepository = groupRepository;
		this.membershipRepository = membershipRepository;
		this.resourceService = resourceService;
		this.accountService = accountService;
		this.questionService = questionService;
	}

	/**
	 * Los grupos visibles de un curso, del más reciente al más antiguo.
	 * Pública: sin sesión la lista se lee. `viewerId` es null sin sesión.
	 */
	@Transactional(readOnly = true)
	public List<StudyGroupDto> listGroups(Long courseId, Long viewerId) {
		List<StudyGroup> groups = groupRepository.findByCourseIdAndRetiredAtIsNullOrderByCreatedAtDescIdDesc(courseId);
		if (groups.isEmpty()) {
			return List.of();
		}
		boolean viewerIsTeam = viewerId != null && accountService.isTeamMember(viewerId);
		Set<Long> memberOf = viewerId == null ? Set.of()
				: membershipRepository.findGroupIdsOfMember(viewerId, groups.stream().map(StudyGroup::getId).toList());
		return groups.stream()
				.map(group -> toDto(group, memberOf.contains(group.getId()), viewerId, viewerIsTeam))
				.toList();
	}

	/**
	 * Crea un grupo de un curso, con su hilo en el foro del curso y con quien
	 * lo crea como primer miembro, todo en la misma transacción. El texto se
	 * guarda sin los espacios de los extremos, y una descripción vacía como
	 * ausente.
	 *
	 * @throws FieldValidationException si el curso no existe
	 * @throws StudyGroupNameTakenException si en el curso ya hay un grupo
	 *         visible con ese nombre, sin distinguir mayúsculas ni tildes
	 */
	@Transactional
	public StudyGroupDto createGroup(CreateStudyGroupRequest request, Long creatorId) {
		if (!resourceService.courseExists(request.courseId())) {
			throw new FieldValidationException("courseId", "Elige un curso del catálogo.");
		}
		String name = request.name().strip();
		String description = request.description() == null ? "" : request.description().strip();
		String normalizedName = resourceService.comparableName(name);
		if (groupRepository.existsByCourseIdAndNormalizedNameAndRetiredAtIsNull(request.courseId(), normalizedName)) {
			throw new StudyGroupNameTakenException();
		}

		Long threadId = questionService.createGroupThread(request.courseId(), name, description, creatorId);
		StudyGroup group = new StudyGroup(request.courseId(), name, normalizedName,
				description.isEmpty() ? null : description, creatorId, threadId);

		// La comprobación anterior no cubre dos grupos con el mismo nombre
		// creados a la vez: el segundo lo detiene el índice único. El flush
		// hace que falle aquí y no al confirmar, y la transacción se deshace
		// entera, con el hilo que ya se había creado.
		try {
			groupRepository.saveAndFlush(group);
		} catch (DataIntegrityViolationException exception) {
			if (violates(exception, UNIQUE_NAME_CONSTRAINT)) {
				throw new StudyGroupNameTakenException();
			}
			throw exception;
		}
		membershipRepository.save(new Membership(group.getId(), creatorId));
		return toDto(group, true, creatorId, false);
	}

	/**
	 * Retira un grupo: deja de verse, con su hilo del foro, pero no se borra.
	 * Lo retira quien lo creó o una cuenta del equipo.
	 *
	 * @throws StudyGroupNotFoundException si no existe o ya estaba retirado
	 * @throws StudyGroupChangeForbiddenException si quien pide no puede
	 */
	@Transactional
	public void retireGroup(Long id, Long accountId) {
		StudyGroup group = groupRepository.findForUpdateByIdAndRetiredAtIsNull(id)
				.orElseThrow(StudyGroupNotFoundException::new);
		if (!canRetire(group, accountId, accountService.isTeamMember(accountId))) {
			throw new StudyGroupChangeForbiddenException();
		}
		group.retire(accountId, Instant.now());
		questionService.retireGroupThread(group.getThreadId(), accountId);
	}

	private static boolean violates(DataIntegrityViolationException exception, String constraint) {
		return exception.getCause() instanceof ConstraintViolationException violation
				&& constraint.equals(violation.getConstraintName());
	}

	private static boolean canRetire(StudyGroup group, Long viewerId, boolean viewerIsTeam) {
		return viewerId != null && (viewerIsTeam || viewerId.equals(group.getCreatorId()));
	}

	private static StudyGroupDto toDto(StudyGroup group, boolean member, Long viewerId, boolean viewerIsTeam) {
		return new StudyGroupDto(group.getId(), group.getCourseId(), group.getName(), group.getDescription(),
				group.getCreatedAt(), group.getThreadId(), member, canRetire(group, viewerId, viewerIsTeam));
	}

}
