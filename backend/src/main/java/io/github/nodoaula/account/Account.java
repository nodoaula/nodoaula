package io.github.nodoaula.account;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "accounts")
class Account {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String email;

	private String passwordHash;

	private Instant createdAt;

	// Cuenta del equipo, que modera el catálogo (ADR-007). Se marca en la base
	// de datos, nunca desde la aplicación: una cuenta nueva no la tiene.
	private boolean teamMember;

	private Instant dataProcessingAuthorizedAt;

	// El perfil (HU506). Vacío en las cuentas creadas antes de pedirlo, hasta
	// que lo completan; la tabla exige los tres o ninguno.
	private String name;

	@ManyToOne(fetch = FetchType.LAZY)
	private Institution institution;

	@Enumerated(EnumType.STRING)
	private UserType userType;

	protected Account() {
	}

	// Una cuenta nueva siempre nace con su perfil y con la autorización de
	// tratar sus datos: el registro no deja crearla sin ellos.
	Account(String email, String passwordHash, String name, Institution institution, UserType userType) {
		this.email = email;
		this.passwordHash = passwordHash;
		this.createdAt = Instant.now();
		this.dataProcessingAuthorizedAt = createdAt;
		this.name = name;
		this.institution = institution;
		this.userType = userType;
	}

	/**
	 * Guarda el perfil de una cuenta que no lo tenía. Renueva la fecha de la
	 * autorización porque se da en el mismo paso, sobre la política que ya
	 * menciona estos datos: la fecha dice qué versión aceptó.
	 */
	void completeProfile(String name, Institution institution, UserType userType) {
		this.name = name;
		this.institution = institution;
		this.userType = userType;
		this.dataProcessingAuthorizedAt = Instant.now();
	}

	boolean isProfileComplete() {
		return name != null;
	}

	Long getId() {
		return id;
	}

	String getEmail() {
		return email;
	}

	String getPasswordHash() {
		return passwordHash;
	}

	Instant getCreatedAt() {
		return createdAt;
	}

	boolean isTeamMember() {
		return teamMember;
	}

	Instant getDataProcessingAuthorizedAt() {
		return dataProcessingAuthorizedAt;
	}

	String getName() {
		return name;
	}

	Institution getInstitution() {
		return institution;
	}

	UserType getUserType() {
		return userType;
	}

}
