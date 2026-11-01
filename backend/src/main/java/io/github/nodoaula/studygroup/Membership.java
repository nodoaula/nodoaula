package io.github.nodoaula.studygroup;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Pertenencia de una cuenta a un grupo de estudio. Quien crea el grupo es su
 * primer miembro (HU404). El grupo se guarda por identificador, como las
 * respuestas guardan su pregunta; la cuenta, porque vive en otro módulo.
 */
@Entity
@Table(name = "study_group_members")
class Membership {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private Long groupId;

	private Long accountId;

	private Instant joinedAt;

	protected Membership() {
	}

	Membership(Long groupId, Long accountId) {
		this.groupId = groupId;
		this.accountId = accountId;
		this.joinedAt = Instant.now();
	}

}
