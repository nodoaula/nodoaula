package io.github.nodoaula.studygroup;

import io.github.nodoaula.shared.error.ConflictException;

/** Nadie se une dos veces al mismo grupo (HU405). */
class AlreadyAMemberException extends ConflictException {

	AlreadyAMemberException() {
		super("ALREADY_A_MEMBER", "Ya eres miembro de este grupo.");
	}

}
