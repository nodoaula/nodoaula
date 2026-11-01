package io.github.nodoaula.studygroup;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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
 * grupo, siempre a través de sus servicios. Unirse y salir (HU405) no tocan
 * el foro: quién responde en el hilo lo decide la pertenencia, que el foro
 * consulta a MembershipService.
 */
@Service
public class StudyGroupService {

	// El índice único parcial de la migración V202610312331.
	private static final String UNIQUE_NAME_CONSTRAINT = "study_groups_course_id_normalized_name_key";

	// La restricción única de study_group_members, de la misma migración.
	private static final String UNIQUE_MEMBER_CONSTRAINT = "study_group_members_group_id_account_id_key";

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
		List<Long> groupIds = groups.stream().map(StudyGroup::getId).toList();
		Set<Long> memberOf = viewerId == null ? Set.of() : membershipRepository.findGroupIdsOfMember(viewerId, groupIds);
		Map<Long, Long> memberCounts = membershipRepository.countByGroupIds(groupIds).stream()
				.collect(Collectors.toMap(MembershipRepository.MemberCount::getGroupId,
						MembershipRepository.MemberCount::getMembers));
		return groups.stream()
				.map(group -> toDto(group, memberCounts.getOrDefault(group.getId(), 0L),
						memberOf.contains(group.getId()), viewerId, viewerIsTeam))
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
		return toDto(group, 1, true, creatorId, false);
	}

	/**
	 * Une la cuenta a un grupo visible. Un grupo sin miembros sigue abierto:
	 * cualquiera puede unirse a él.
	 *
	 * @return el grupo, ya con la cuenta como miembro
	 * @throws StudyGroupNotFoundException si no existe o está retirado
	 * @throws AlreadyAMemberException si la cuenta ya es miembro
	 */
	@Transactional
	public StudyGroupDto joinGroup(Long id, Long accountId) {
		StudyGroup group = groupRepository.findForShareByIdAndRetiredAtIsNull(id)
				.orElseThrow(StudyGroupNotFoundException::new);
		if (membershipRepository.existsByGroupIdAndAccountId(id, accountId)) {
			throw new AlreadyAMemberException();
		}

		// Como al crear un grupo: dos peticiones a la vez de la misma cuenta
		// pasan las dos la comprobación anterior, y la segunda la detiene la
		// restricción única.
		try {
			membershipRepository.saveAndFlush(new Membership(id, accountId));
		} catch (DataIntegrityViolationException exception) {
			if (violates(exception, UNIQUE_MEMBER_CONSTRAINT)) {
				throw new AlreadyAMemberException();
			}
			throw exception;
		}
		return toDto(group, membershipRepository.countByGroupId(id), true, accountId,
				accountService.isTeamMember(accountId));
	}

	/**
	 * Saca la cuenta de un grupo visible. Desde ese momento no responde en su
	 * hilo. Si era el último miembro, aunque sea quien lo creó, el grupo no se
	 * retira: sigue en la lista, su hilo se sigue leyendo y cualquiera puede
	 * unirse.
	 *
	 * @return el grupo, ya sin la cuenta como miembro
	 * @throws StudyGroupNotFoundException si no existe o está retirado
	 * @throws NotAMemberException si la cuenta no es miembro
	 */
	@Transactional
	public StudyGroupDto leaveGroup(Long id, Long accountId) {
		StudyGroup group = groupRepository.findForShareByIdAndRetiredAtIsNull(id)
				.orElseThrow(StudyGroupNotFoundException::new);
		if (membershipRepository.deleteByGroupIdAndAccountId(id, accountId) == 0) {
			throw new NotAMemberException();
		}
		return toDto(group, membershipRepository.countByGroupId(id), false, accountId,
				accountService.isTeamMember(accountId));
	}

	/**
	 * Los miembros de un grupo visible, del primero que se unió al último.
	 * Solo los ve quien pertenece a él; ni siquiera una cuenta del equipo que
	 * no sea miembro.
	 *
	 * @throws StudyGroupNotFoundException si no existe o está retirado
	 * @throws StudyGroupMembersOnlyException si quien pide no es miembro
	 */
	@Transactional(readOnly = true)
	public List<StudyGroupMemberDto> listMembers(Long id, Long viewerId) {
		StudyGroup group = groupRepository.findByIdAndRetiredAtIsNull(id)
				.orElseThrow(StudyGroupNotFoundException::new);
		List<Membership> members = membershipRepository.findByGroupIdOrderByJoinedAtAscIdAsc(id);
		if (members.stream().noneMatch(member -> member.getAccountId().equals(viewerId))) {
			throw new StudyGroupMembersOnlyException();
		}
		return members.stream()
				.map(member -> new StudyGroupMemberDto(member.getJoinedAt(), member.getAccountId().equals(viewerId),
						member.getAccountId().equals(group.getCreatorId())))
				.toList();
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

	private static StudyGroupDto toDto(StudyGroup group, long memberCount, boolean member, Long viewerId,
			boolean viewerIsTeam) {
		return new StudyGroupDto(group.getId(), group.getCourseId(), group.getName(), group.getDescription(),
				group.getCreatedAt(), group.getThreadId(), memberCount, member,
				canRetire(group, viewerId, viewerIsTeam));
	}

}
