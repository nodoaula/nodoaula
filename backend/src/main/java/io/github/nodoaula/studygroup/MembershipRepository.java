package io.github.nodoaula.studygroup;

import java.util.Collection;
import java.util.List;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

	boolean existsByGroupIdAndAccountId(Long groupId, Long accountId);

	/** Los miembros de un grupo, del primero que se unió al último. */
	List<Membership> findByGroupIdOrderByJoinedAtAscIdAsc(Long groupId);

	long countByGroupId(Long groupId);

	/**
	 * Cuántos miembros tiene cada uno de esos grupos, en una sola consulta.
	 * Los que no tienen ninguno no aparecen.
	 */
	@Query("select m.groupId as groupId, count(m) as members from Membership m"
			+ " where m.groupId in :groupIds group by m.groupId")
	List<MemberCount> countByGroupIds(Collection<Long> groupIds);

	/** Saca a la cuenta del grupo. Devuelve cuántas filas borró: 0 si no era miembro. */
	@Modifying
	@Query("delete from Membership m where m.groupId = :groupId and m.accountId = :accountId")
	int deleteByGroupIdAndAccountId(Long groupId, Long accountId);

	interface MemberCount {

		Long getGroupId();

		long getMembers();

	}

}
