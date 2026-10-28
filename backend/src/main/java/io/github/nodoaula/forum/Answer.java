package io.github.nodoaula.forum;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Respuesta a una pregunta del foro (historia HU402). La pregunta y el autor
 * se guardan por identificador: nada lee la pregunta a través de la
 * respuesta, y quien la necesita la pide bloqueada a su repositorio.
 */
@Entity
@Table(name = "forum_answers")
class Answer {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private Long questionId;

	private Long authorId;

	private String body;

	private Instant createdAt;

	// Una respuesta retirada no se borra: deja de verse. Las dos columnas van
	// juntas, como en el retiro de una pregunta.
	private Instant retiredAt;

	private Long retiredBy;

	protected Answer() {
	}

	Answer(Long questionId, Long authorId, String body) {
		this.questionId = questionId;
		this.authorId = authorId;
		this.body = body;
		this.createdAt = Instant.now();
	}

	void retire(Long accountId, Instant at) {
		this.retiredBy = accountId;
		this.retiredAt = at;
	}

	Long getId() {
		return id;
	}

	Long getAuthorId() {
		return authorId;
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

}
