package io.github.nodoaula.studygroup;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Grupo de estudio de un curso (historia HU404). El curso, quien lo creó y su
 * hilo del foro se guardan por identificador: viven en otros módulos y sus
 * entidades no son públicas (ADR-008).
 */
@Entity
@Table(name = "study_groups")
class StudyGroup {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private Long courseId;

	private String name;

	// La forma comparable del nombre, como la de los cursos y los temas: dos
	// grupos visibles de un curso no pueden compartirla.
	private String normalizedName;

	// Opcional: null si el grupo no tiene descripción.
	private String description;

	private Long creatorId;

	// La pregunta del foro del curso en la que conversa el grupo.
	private Long threadId;

	private Instant createdAt;

	// Un grupo retirado no se borra: deja de verse, con su hilo. Las dos
	// columnas van juntas, como en el retiro de una pregunta.
	private Instant retiredAt;

	private Long retiredBy;

	protected StudyGroup() {
	}

	StudyGroup(Long courseId, String name, String normalizedName, String description, Long creatorId,
			Long threadId) {
		this.courseId = courseId;
		this.name = name;
		this.normalizedName = normalizedName;
		this.description = description;
		this.creatorId = creatorId;
		this.threadId = threadId;
		this.createdAt = Instant.now();
	}

	void retire(Long accountId, Instant at) {
		this.retiredBy = accountId;
		this.retiredAt = at;
	}

	Long getId() {
		return id;
	}

	Long getCourseId() {
		return courseId;
	}

	String getName() {
		return name;
	}

	String getDescription() {
		return description;
	}

	Long getCreatorId() {
		return creatorId;
	}

	Long getThreadId() {
		return threadId;
	}

	Instant getCreatedAt() {
		return createdAt;
	}

}
