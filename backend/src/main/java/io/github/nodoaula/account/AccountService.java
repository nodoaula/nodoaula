package io.github.nodoaula.account;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.shared.error.FieldValidationException;

/**
 * Único punto público del módulo account, conforme al ADR-008. Es también el
 * UserDetailsService con el que el filtro de login de Spring Security busca la
 * cuenta, de modo que el repositorio solo se llama desde aquí.
 */
@Service
public class AccountService implements UserDetailsService {

	private static final Pattern WHITESPACE = Pattern.compile("\\s+");

	private final AccountRepository accountRepository;
	private final InstitutionRepository institutionRepository;
	private final PasswordEncoder passwordEncoder;

	AccountService(AccountRepository accountRepository, InstitutionRepository institutionRepository,
			PasswordEncoder passwordEncoder) {
		this.accountRepository = accountRepository;
		this.institutionRepository = institutionRepository;
		this.passwordEncoder = passwordEncoder;
	}

	/**
	 * Crea una cuenta, con su perfil. No inicia sesión: el usuario entra
	 * después con el formulario de inicio de sesión.
	 *
	 * @throws EmailAlreadyInUseException si el correo ya tiene cuenta
	 * @throws FieldValidationException si la institución no es de la lista
	 */
	@Transactional
	public AccountDto register(RegistrationRequest request) {
		String email = normalizeEmail(request.email());

		if (accountRepository.existsByEmail(email)) {
			throw new EmailAlreadyInUseException();
		}

		Account account = new Account(email, passwordEncoder.encode(request.password()), tidyName(request.name()),
				findInstitution(request.institutionId()), request.userType());

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

	/**
	 * Si la cuenta está marcada como del equipo, que puede corregir o retirar
	 * cualquier recurso del catálogo (ADR-007). Se consulta en cada operación
	 * y no se guarda en la sesión, para que marcar o desmarcar una cuenta en
	 * la base surta efecto sin que tenga que volver a iniciar sesión. Una
	 * cuenta que no existe no es del equipo.
	 */
	@Transactional(readOnly = true)
	public boolean isTeamMember(Long accountId) {
		return accountRepository.existsByIdAndTeamMemberTrue(accountId);
	}

	/**
	 * La cuenta con sesión, leída de la base y no de la sesión guardada: el
	 * nombre puede haber llegado después de iniciarla, al completar el perfil.
	 */
	@Transactional(readOnly = true)
	public AccountDto currentAccount(Long accountId) {
		return toDto(findAccount(accountId));
	}

	/** Todos los datos de la cuenta con sesión, para su página de perfil. */
	@Transactional(readOnly = true)
	public AccountProfileDto profile(Long accountId) {
		Account account = findAccount(accountId);
		Institution institution = account.getInstitution();
		return new AccountProfileDto(account.getName(), account.getEmail(),
				institution == null ? null : institution.toDto(), account.getUserType(), account.getCreatedAt(),
				account.getDataProcessingAuthorizedAt(), account.isTeamMember());
	}

	/**
	 * Guarda el perfil de una cuenta creada antes de pedirlo, junto con la
	 * nueva autorización de tratar sus datos.
	 *
	 * @throws ProfileAlreadyCompleteException si la cuenta ya lo tiene
	 * @throws FieldValidationException si la institución no es de la lista
	 */
	@Transactional
	public AccountDto completeProfile(Long accountId, ProfileCompletionRequest request) {
		Account account = findAccount(accountId);
		if (account.isProfileComplete()) {
			throw new ProfileAlreadyCompleteException();
		}

		account.completeProfile(tidyName(request.name()), findInstitution(request.institutionId()),
				request.userType());
		return toDto(account);
	}

	/**
	 * La ficha de quien aportó un recurso (HU507), que puede ver cualquiera:
	 * nunca el correo. Sin una cuenta de autor, como el catálogo semilla, o
	 * desde una cuenta de prueba, el aporte es del equipo y no lleva nombre.
	 * Una cuenta del equipo con perfil lleva su nombre; una sin perfil, ninguno.
	 * «Otra» no dice nada de la institución, así que no se muestra.
	 */
	@Transactional(readOnly = true)
	public ContributorDto contributor(Long authorId) {
		Account account = accountRepository.findById(authorId).orElse(null);
		if (account == null || account.isTeamTestAccount()) {
			return ContributorDto.TEAM;
		}

		ContributorOrigin origin = account.isTeamMember() ? ContributorOrigin.TEAM : ContributorOrigin.COMMUNITY;
		if (!account.isProfileComplete()) {
			return origin == ContributorOrigin.TEAM ? ContributorDto.TEAM : ContributorDto.COMMUNITY_MEMBER;
		}

		Institution institution = account.getInstitution();
		return new ContributorDto(origin, account.getName(), account.getUserType(),
				institution.isOther() ? null : institution.getName());
	}

	/** La lista cerrada de instituciones, por nombre y con «Otra» al final. */
	@Transactional(readOnly = true)
	public List<InstitutionDto> listInstitutions() {
		return institutionRepository.findAllByOrderByName().stream()
				.sorted(Comparator.comparing(Institution::isOther))
				.map(Institution::toDto)
				.toList();
	}

	// Una sesión cuya cuenta ya no existe se trata como sin sesión: 401.
	private Account findAccount(Long accountId) {
		return accountRepository.findById(accountId)
				.orElseThrow(() -> new UsernameNotFoundException("La cuenta de la sesión no existe"));
	}

	// Solo de la lista: un identificador que no está en ella se señala en el
	// campo, como cualquier otro dato del formulario.
	private Institution findInstitution(Long institutionId) {
		return institutionRepository.findById(institutionId)
				.orElseThrow(() -> new FieldValidationException("institutionId",
						ProfileCompletionRequest.INSTITUTION_REQUIRED));
	}

	// Como el frontend: sin espacios al principio, al final ni repetidos.
	private static String tidyName(String name) {
		return WHITESPACE.matcher(name.strip()).replaceAll(" ");
	}

	// En minúsculas para que Ana@Ejemplo.com y ana@ejemplo.com sean la misma
	// cuenta. La tabla rechaza cualquier correo que no llegue así.
	static String normalizeEmail(String email) {
		return email.strip().toLowerCase(Locale.ROOT);
	}

	private static AccountDto toDto(Account account) {
		return new AccountDto(account.getId(), account.getEmail(), account.getName(), account.isProfileComplete());
	}

}
