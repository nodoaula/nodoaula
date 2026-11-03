package io.github.nodoaula.studygroup;

import io.github.nodoaula.shared.error.ForbiddenException;

/** Un grupo solo lo retira quien lo creó o una cuenta del equipo (HU404). */
class StudyGroupChangeForbiddenException extends ForbiddenException {

	StudyGroupChangeForbiddenException() {
		super("STUDY_GROUP_CHANGE_FORBIDDEN", "Solo quien creó este grupo o una cuenta del equipo puede retirarlo.");
	}

}
