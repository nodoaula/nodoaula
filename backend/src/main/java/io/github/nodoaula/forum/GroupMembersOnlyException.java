package io.github.nodoaula.forum;

import io.github.nodoaula.shared.error.ForbiddenException;

/** En el hilo de un grupo de estudio solo responden sus miembros (HU404). */
class GroupMembersOnlyException extends ForbiddenException {

	GroupMembersOnlyException() {
		super("GROUP_MEMBERS_ONLY", "Solo los miembros del grupo responden en su hilo. Únete al grupo para participar.");
	}

}
