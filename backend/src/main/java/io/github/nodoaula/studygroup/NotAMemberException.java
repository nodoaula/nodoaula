package io.github.nodoaula.studygroup;

import io.github.nodoaula.shared.error.ConflictException;

/** Solo sale de un grupo quien pertenece a él (HU405). */
class NotAMemberException extends ConflictException {

	NotAMemberException() {
		super("NOT_A_MEMBER", "No eres miembro de este grupo.");
	}

}
