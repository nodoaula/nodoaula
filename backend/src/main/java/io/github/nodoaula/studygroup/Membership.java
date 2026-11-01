package io.github.nodoaula.studygroup;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Pertenencia de una cuenta a un grupo de estudio. Quien crea el grupo es su
 * primer miembro (HU404), y cualquier cuenta se une o sale después (HU405):
 * salir borra la fila. El grupo se guarda por identificador, como las
 * respuestas guardan su pregunta; la cuenta, porque vive en otro módulo.
 */
@Entity
@Table(name = "study_group_members")
class Membership {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	// Las consultas de MembershipRepository leen estas columnas por su nombre.
	// Por eso cada una se nombra aquí.
	@Column(name = "group_id")
	private Long groupId;

	@Column(name = "account_id")
	private Long accountId;

	@Column(name = "joined_at")
	private Instant joinedAt;

	protected Membership() {
	}

	Membership(Long groupId, Long accountId) {
		this.groupId = groupId;
		this.accountId = accountId;
		this.joinedAt = Instant.now();
	}

	Long getAccountId() {
		return accountId;
	}

	Instant getJoinedAt() {
		return joinedAt;
	}

}
