package io.github.nodoaula.forum;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Pregunta del foro de un curso (historia HU401). El curso, el recurso y el
 * autor se guardan por identificador: viven en otros módulos y sus entidades
 * no son públicas (ADR-008).
 */
@Entity
@Table(name = "forum_questions")
class Question {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private Long courseId;

	// Opcional: la pregunta puede ser sobre un recurso concreto del curso.
	private Long resourceId;

	private Long authorId;

	private String title;

	private String body;

	private Instant createdAt;

	// Una pregunta retirada no se borra: deja de verse, con sus respuestas.
	// Las dos columnas van juntas, como en el retiro de un recurso.
	private Instant retiredAt;

	private Long retiredBy;

	// La respuesta que quien preguntó marcó como útil, o null.
	private Long usefulAnswerId;

	// El hilo de un grupo de estudio (HU404): solo lo responden los miembros
	// del grupo, y se retira con el grupo y no desde el foro.
	private boolean groupThread;

	protected Question() {
	}

	Question(Long courseId, Long resourceId, Long authorId, String title, String body) {
		this(courseId, resourceId, authorId, title, body, false);
	}

	private Question(Long courseId, Long resourceId, Long authorId, String title, String body, boolean groupThread) {
		this.courseId = courseId;
		this.resourceId = resourceId;
		this.authorId = authorId;
		this.title = title;
		this.body = body;
		this.groupThread = groupThread;
		this.createdAt = Instant.now();
	}

	/** El hilo de un grupo: su nombre como título y su descripción, que puede ser vacía, como cuerpo. */
	static Question groupThread(Long courseId, Long creatorId, String name, String description) {
		return new Question(courseId, null, creatorId, name, description, true);
	}

	void retire(Long accountId, Instant at) {
		this.retiredBy = accountId;
		this.retiredAt = at;
	}

	void markUseful(Answer answer) {
		this.usefulAnswerId = answer.getId();
	}

	void clearUseful() {
		this.usefulAnswerId = null;
	}

	Long getId() {
		return id;
	}

	Long getCourseId() {
		return courseId;
	}

	Long getResourceId() {
		return resourceId;
	}

	Long getAuthorId() {
		return authorId;
	}

	String getTitle() {
		return title;
	}

	String getBody() {
		return body;
	}

	Instant getCreatedAt() {
		return createdAt;
	}

	boolean isRetired() {
		return retiredAt != null;
	}

	Long getUsefulAnswerId() {
		return usefulAnswerId;
	}

	boolean isGroupThread() {
		return groupThread;
	}

}
