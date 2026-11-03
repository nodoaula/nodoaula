package io.github.nodoaula.studygroup;

import io.github.nodoaula.shared.error.ForbiddenException;

/** La lista de miembros de un grupo la ven solo quienes pertenecen a él (HU405). */
class StudyGroupMembersOnlyException extends ForbiddenException {

	StudyGroupMembersOnlyException() {
		super("STUDY_GROUP_MEMBERS_ONLY", "Solo los miembros del grupo ven quiénes pertenecen a él.");
	}

}
