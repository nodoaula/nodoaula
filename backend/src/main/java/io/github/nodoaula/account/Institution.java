package io.github.nodoaula.account;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Institución de educación superior de la lista cerrada del SNIES, más «Otra»
 * (HU506). La carga una migración: la aplicación nunca crea ni modifica una.
 */
@Entity
@Table(name = "institutions")
class Institution {

	@Id
	private Long id;

	private Integer sniesCode;

	private String name;

	protected Institution() {
	}

	Long getId() {
		return id;
	}

	String getName() {
		return name;
	}

	// «Otra» es la única sin código SNIES; la tabla no admite una segunda.
	boolean isOther() {
		return sniesCode == null;
	}

	InstitutionDto toDto() {
		return new InstitutionDto(id, name, isOther());
	}

}
