package io.github.nodoaula.account;

import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Único punto público del módulo account, conforme al ADR-008. */
@Service
public class AccountService {

	private final AccountRepository accountRepository;
	private final PasswordEncoder passwordEncoder;

	AccountService(AccountRepository accountRepository, PasswordEncoder passwordEncoder) {
		this.accountRepository = accountRepository;
		this.passwordEncoder = passwordEncoder;
	}

	/**
	 * Crea una cuenta. No inicia sesión: el usuario entra después con el
	 * formulario de inicio de sesión.
	 *
	 * @throws EmailAlreadyInUseException si el correo ya tiene cuenta
	 */
	@Transactional
	public AccountDto register(RegistrationRequest request) {
		String email = normalizeEmail(request.email());

		if (accountRepository.existsByEmail(email)) {
			throw new EmailAlreadyInUseException();
		}

		Account account = new Account(email, passwordEncoder.encode(request.password()));

		// La comprobación anterior no cubre dos registros simultáneos con el
		// mismo correo: el segundo lo detiene la restricción única de la tabla.
		// El flush es lo que hace que falle aquí y no al confirmar la
		// transacción, fuera de este try.
		try {
			accountRepository.saveAndFlush(account);
		} catch (DataIntegrityViolationException exception) {
			throw new EmailAlreadyInUseException();
		}

		return toDto(account);
	}

	// En minúsculas para que Ana@Ejemplo.com y ana@ejemplo.com sean la misma
	// cuenta. La tabla rechaza cualquier correo que no llegue así.
	private static String normalizeEmail(String email) {
		return email.strip().toLowerCase(Locale.ROOT);
	}

	private static AccountDto toDto(Account account) {
		return new AccountDto(account.getId(), account.getEmail());
	}

}
