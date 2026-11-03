package io.github.nodoaula.account;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.MigrationScripts;

/**
 * HU507, CA 4: las cuentas creadas antes de pedir la autorización de datos
 * son cuentas de prueba del equipo, y lo que aportan se muestra como del
 * equipo. La migración que las marca se aplicó al arrancar, sobre lo que
 * hubiera en la base; aquí su update se aplica a cuentas que crea la prueba,
 * con correos únicos, y la transacción lo deshace al terminar.
 */
@SpringBootTest
@Transactional
class TeamTestAccountTests {

	private static final String MIGRATION = "V202611011901__add_account_team_test_account.sql";

	@Autowired
	private AccountService accountService;

	@Autowired
	private JdbcClient jdbc;

	private boolean isTeamTestAccount(Long accountId) {
		return jdbc.sql("select team_test_account from accounts where id = ?").param(accountId)
				.query(Boolean.class).single();
	}

	private void applyMigration() {
		jdbc.sql(MigrationScripts.updateStatementOf(MIGRATION)).update();
	}

	@Test
	void anAccountThatNeverAuthorizedIsATestAccount() {
		Long account = AccountTestSupport.accountWithoutProfile(jdbc, AccountTestSupport.uniqueEmail(), null);

		applyMigration();

		assertThat(isTeamTestAccount(account)).isTrue();
		assertThat(accountService.contributor(account)).isEqualTo(ContributorDto.TEAM);
	}

	// Una anterior a HU510 que ya completó el perfil autorizó después de crearse.
	@Test
	void anAccountThatAuthorizedAfterBeingCreatedIsATestAccount() {
		Long account = AccountTestSupport.accountWithoutProfile(jdbc, AccountTestSupport.uniqueEmail(),
				Instant.now().plus(3, ChronoUnit.DAYS));

		applyMigration();

		assertThat(isTeamTestAccount(account)).isTrue();
	}

	// Lo que el registro guarda desde HU510: la misma fecha en las dos columnas,
	// también después de pasar por Hibernate y por la precisión de PostgreSQL.
	@Test
	void anAccountRegisteredWithTheAuthorizationIsNotATestAccount() {
		AccountDto registered = accountService.register(new RegistrationRequest(AccountTestSupport.uniqueEmail(),
				AccountTestSupport.PASSWORD, "Camila Rojas", AccountTestSupport.newInstitution(jdbc),
				UserType.STUDENT, true));

		applyMigration();

		assertThat(isTeamTestAccount(registered.id())).isFalse();
		assertThat(accountService.contributor(registered.id()).origin()).isEqualTo(ContributorOrigin.COMMUNITY);
		assertThat(accountService.contributor(registered.id()).name()).isEqualTo("Camila Rojas");
	}

	@Test
	void aNewAccountIsNeverATestAccount() {
		Long account = jdbc.sql("""
				insert into accounts (email, password_hash, created_at, data_processing_authorized_at)
				values (?, '{noop}sin-uso', ?, ?) returning id""")
				.param(AccountTestSupport.uniqueEmail())
				.param(Timestamp.from(Instant.now()))
				.param(Timestamp.from(Instant.now()))
				.query(Long.class).single();

		assertThat(isTeamTestAccount(account)).isFalse();
	}

	// La marca no es la de cuenta del equipo: no da permiso para moderar.
	@Test
	void aTestAccountCannotModerate() {
		Long account = AccountTestSupport.accountWithoutProfile(jdbc, AccountTestSupport.uniqueEmail(), null);
		applyMigration();

		assertThat(accountService.isTeamMember(account)).isFalse();
	}

}
