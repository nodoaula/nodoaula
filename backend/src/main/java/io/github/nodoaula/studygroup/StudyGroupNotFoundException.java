package io.github.nodoaula.studygroup;

import io.github.nodoaula.shared.error.NotFoundException;

/** El grupo no existe o fue retirado: para quien lo pide es lo mismo. */
class StudyGroupNotFoundException extends NotFoundException {

	StudyGroupNotFoundException() {
		super("STUDY_GROUP_NOT_FOUND", "El grupo que buscas no existe o ya no está disponible.");
	}

}
