package io.github.nodoaula.studygroup;

import java.util.Collection;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.forum.GroupThreadMembership;

/**
 * Le responde al foro quién es miembro del grupo de un hilo (HU404). Es un
 * servicio aparte de StudyGroupService porque este depende del foro para
 * crear el hilo: si fuera el mismo, el foro y studygroup dependerían el uno
 * del otro. Interno del módulo: el foro lo conoce solo por la interfaz.
 */
@Service
class MembershipService implements GroupThreadMembership {

	private final MembershipRepository membershipRepository;

	MembershipService(MembershipRepository membershipRepository) {
		this.membershipRepository = membershipRepository;
	}

	@Override
	@Transactional(readOnly = true)
	public Set<Long> threadsWithMember(Collection<Long> threadIds, Long accountId) {
		return membershipRepository.findThreadIdsOfMember(accountId, threadIds);
	}

}
