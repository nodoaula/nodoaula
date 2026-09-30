package io.github.nodoaula.catalog;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "courses")
class Course {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String name;

	protected Course() {
	}

	// Para crear un curso nuevo cuando se registra un recurso con uno que no
	// existe en el vocabulario controlado (historia HU105).
	Course(String name) {
		this.name = name;
	}

	Long getId() {
		return id;
	}

	String getName() {
		return name;
	}

}
