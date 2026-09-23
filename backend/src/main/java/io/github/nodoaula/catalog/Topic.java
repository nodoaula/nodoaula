package io.github.nodoaula.catalog;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "topics")
class Topic {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "course_id")
	private Course course;

	private String name;

	protected Topic() {
	}

	// Para crear un tema nuevo cuando se registra un recurso con uno que no
	// existe en el vocabulario controlado del curso (historia HU105).
	Topic(Course course, String name) {
		this.course = course;
		this.name = name;
	}

	Long getId() {
		return id;
	}

	Course getCourse() {
		return course;
	}

	String getName() {
		return name;
	}

}
