package io.github.nodoaula.forum;

import io.github.nodoaula.shared.error.ForbiddenException;

/**
 * El hilo de un grupo no se retira desde el foro: se retira con el grupo
 * (HU404), para que no quede un grupo visible sin su hilo.
 */
class GroupThreadChangeForbiddenException extends ForbiddenException {

	GroupThreadChangeForbiddenException() {
		super("GROUP_THREAD_CHANGE_FORBIDDEN", "El hilo de un grupo se retira retirando el grupo.");
	}

}
