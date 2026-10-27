package io.github.nodoaula.forum;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Respuesta a una pregunta del foro (historia HU402). La pregunta es del mismo
 * módulo y se relaciona como entidad; el autor vive en otro y se guarda por
 * identificador.
 */
@Entity
@Table(name = "forum_answers")
class Answer {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "question_id")
	private Question question;

	private Long authorId;

	private String body;

	private Instant createdAt;

	// Una respuesta retirada no se borra: deja de verse. Las dos columnas van
	// juntas, como en el retiro de una pregunta.
	private Instant retiredAt;

	private Long retiredBy;

	protected Answer() {
	}

	Answer(Question question, Long authorId, String body) {
		this.question = question;
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

	Question getQuestion() {
		return question;
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
