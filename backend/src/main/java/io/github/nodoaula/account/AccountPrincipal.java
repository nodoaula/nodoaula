package io.github.nodoaula.account;

import java.io.Serial;
import java.util.List;

import org.springframework.security.core.userdetails.User;

/**
 * Cuenta con sesión iniciada. Es lo que Spring Security guarda en la sesión,
 * serializado en la base de datos: quitar un campo, cambiar su tipo o cambiar
 * el serialVersionUID impide leer las sesiones que estaban abiertas al
 * desplegar.
 *
 * El hash de la contraseña solo está mientras se comprueban las credenciales;
 * después Spring Security lo borra, antes de guardar la sesión.
 */
final class AccountPrincipal extends User {

	@Serial
	private static final long serialVersionUID = 1L;

	private final Long id;

	// Sin roles: no hay administrador y cualquier cuenta puede aportar.
	AccountPrincipal(Long id, String email, String passwordHash) {
		super(email, passwordHash, List.of());
		this.id = id;
	}

	Long getId() {
		return id;
	}

	AccountDto toDto() {
		return new AccountDto(id, getUsername());
	}

}
