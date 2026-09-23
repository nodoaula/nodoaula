package io.github.nodoaula.account;

import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Único punto público del módulo account, conforme al ADR-008. Es también el
 * UserDetailsService con el que el filtro de login de Spring Security busca la
 * cuenta, de modo que el repositorio solo se llama desde aquí.
 */
@Service
public class AccountService implements UserDetailsService {

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

	/**
	 * Busca la cuenta con la que se intenta iniciar sesión. El correo se
	 * normaliza igual que al registrarse, para que Ana@Ejemplo.com entre en la
	 * cuenta de ana@ejemplo.com.
	 *
	 * La excepción no llega al usuario: Spring Security la convierte en el
	 * mismo error que una contraseña incorrecta, y aun así compara un hash
	 * para que el tiempo de respuesta tampoco delate si el correo existe.
	 */
	@Override
	@Transactional(readOnly = true)
	public UserDetails loadUserByUsername(String email) {
		return accountRepository.findByEmail(normalizeEmail(email))
				.map(account -> new AccountPrincipal(account.getId(), account.getEmail(), account.getPasswordHash()))
				.orElseThrow(() -> new UsernameNotFoundException("No hay cuenta con ese correo"));
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
