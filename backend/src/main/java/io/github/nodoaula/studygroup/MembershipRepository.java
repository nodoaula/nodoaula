package io.github.nodoaula.studygroup;

import java.util.Collection;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface MembershipRepository extends JpaRepository<Membership, Long> {

	/** De esos grupos, aquellos de los que la cuenta es miembro. */
	@Query("select m.groupId from Membership m where m.accountId = :accountId and m.groupId in :groupIds")
	Set<Long> findGroupIdsOfMember(Long accountId, Collection<Long> groupIds);

	/**
	 * De esos hilos del foro, aquellos cuyo grupo tiene a la cuenta como
	 * miembro. Un hilo que no es de ningún grupo no aparece.
	 */
	@Query("select g.threadId from StudyGroup g, Membership m"
			+ " where m.groupId = g.id and m.accountId = :accountId and g.threadId in :threadIds")
	Set<Long> findThreadIdsOfMember(Long accountId, Collection<Long> threadIds);

}
