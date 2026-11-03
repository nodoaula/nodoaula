package io.github.nodoaula.forum;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * Quién responde en el hilo de un grupo de estudio (historia HU404): solo sus
 * miembros. Lo implementa el módulo studygroup, que es el que sabe quién
 * pertenece a cada grupo. Se declara aquí para que el foro no dependa de
 * studygroup, que ya depende del foro para crear y retirar el hilo: así la
 * dependencia entre los dos módulos va en un solo sentido (ADR-008).
 */
public interface GroupThreadMembership {

	/** De esos hilos de grupo, aquellos de cuyo grupo la cuenta es miembro. */
	Set<Long> threadsWithMember(Collection<Long> threadIds, Long accountId);

	default boolean isMember(Long threadId, Long accountId) {
		return threadsWithMember(List.of(threadId), accountId).contains(threadId);
	}

}
