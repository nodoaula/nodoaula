package io.github.nodoaula.studygroup;

import io.github.nodoaula.shared.error.ConflictException;

/**
 * En un mismo curso no hay dos grupos con el mismo nombre, sin distinguir
 * mayúsculas ni tildes (HU404), como no hay dos cursos ni dos temas.
 */
class StudyGroupNameTakenException extends ConflictException {

	StudyGroupNameTakenException() {
		super("STUDY_GROUP_NAME_TAKEN", "Ya hay un grupo con ese nombre en este curso.");
	}

}
