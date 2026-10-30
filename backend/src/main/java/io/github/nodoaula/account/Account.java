package io.github.nodoaula.account;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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

	protected Account() {
	}

	// Una cuenta nueva siempre nace con la autorización de tratar sus datos:
	// el registro no deja crearla sin ella.
	Account(String email, String passwordHash) {
		this.email = email;
		this.passwordHash = passwordHash;
		this.createdAt = Instant.now();
		this.dataProcessingAuthorizedAt = createdAt;
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

}
