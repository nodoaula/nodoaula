package io.github.nodoaula.account;

import static io.github.nodoaula.account.AccountTestSupport.PASSWORD;
import static io.github.nodoaula.account.AccountTestSupport.accountWithoutProfile;
import static io.github.nodoaula.account.AccountTestSupport.newInstitution;
import static io.github.nodoaula.account.AccountTestSupport.otherInstitution;
import static io.github.nodoaula.account.AccountTestSupport.register;
import static io.github.nodoaula.account.AccountTestSupport.registration;
import static io.github.nodoaula.account.AccountTestSupport.signedInAs;
import static io.github.nodoaula.account.AccountTestSupport.uniqueEmail;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pruebas de HU506: el perfil que pide el registro, el que completan las
 * cuentas anteriores al volver a iniciar sesión y la página del perfil, que
 * solo ve su dueño. Cada prueba crea sus cuentas y su institución, de modo que
 * no depende de lo que haya en la base.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AccountProfileTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private EntityManager entityManager;

	private Long institutionId;

	@BeforeEach
	void createInstitution() {
		institutionId = newInstitution(jdbc);
	}

	// Las peticiones comparten la transacción de la prueba y su contexto de
	// persistencia: antes de leer con JDBC se vuelca lo pendiente, como el
	// perfil que completa una cuenta ya cargada.
	private Map<String, Object> storedAccount(String email) {
		entityManager.flush();
		return jdbc.sql("select name, institution_id, user_type, data_processing_authorized_at from accounts "
				+ "where email = ?").param(email).query().singleRow();
	}

	private long accountsWith(String email) {
		return jdbc.sql("select count(*) from accounts where email = ?").param(email).query(Long.class).single();
	}

	private static String completion(String name, Long institutionId, String userType, boolean authorized) {
		return """
				{"name":"%s","institutionId":%s,"userType":"%s","dataProcessingAuthorized":%s}"""
				.formatted(name, institutionId, userType, authorized);
	}

	private static MockHttpServletRequestBuilder completeProfile(String body) {
		return put("/api/accounts/me/profile").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private Long registerAccount(String email, String name, Long institution, String userType) throws Exception {
		mockMvc.perform(register(registration(email, name, institution, userType)))
				.andExpect(status().isCreated());
		return jdbc.sql("select id from accounts where email = ?").param(email).query(Long.class).single();
	}

	// CA 1 y 5: el registro pide nombre, institución y tipo de usuario.

	@Test
	void registrationSavesTheProfileWithTheNameTidied() throws Exception {
		String email = uniqueEmail();

		mockMvc.perform(register(registration(email, "  Ana   María  Pérez ", institutionId, "TEACHER")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.name").value("Ana María Pérez"))
				.andExpect(jsonPath("$.profileComplete").value(true));

		Map<String, Object> account = storedAccount(email);
		assertEquals("Ana María Pérez", account.get("name"));
		assertEquals(institutionId, ((Number) account.get("institution_id")).longValue());
		assertEquals("TEACHER", account.get("user_type"));
	}

	@Test
	void registrationWithoutNameInstitutionOrUserTypeIsRejectedOnEachField() throws Exception {
		String email = uniqueEmail();
		String body = """
				{"email":"%s","password":"%s","name":"   ","dataProcessingAuthorized":true}""".formatted(email, PASSWORD);

		mockMvc.perform(register(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[*].field").value(containsInAnyOrder("name", "institutionId", "userType")));

		assertEquals(0, accountsWith(email));
	}

	@Test
	void aNameOverOneHundredCharactersIsRejected() throws Exception {
		String email = uniqueEmail();

		mockMvc.perform(register(registration(email, "a".repeat(101), institutionId, "STUDENT")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("name"));

		assertEquals(0, accountsWith(email));
	}

	@Test
	void onlyStudentAndTeacherAreUserTypes() throws Exception {
		String email = uniqueEmail();

		mockMvc.perform(register(registration(email, "Ana", institutionId, "ADMIN")))
				.andExpect(status().isBadRequest());

		assertEquals(0, accountsWith(email));
	}

	// CA 4: la institución es de la lista cerrada, más «Otra».

	@Test
	void anInstitutionOutsideTheListIsRejectedOnTheField() throws Exception {
		String email = uniqueEmail();
		Long missing = jdbc.sql("select coalesce(max(id), 0) + 1000 from institutions").query(Long.class).single();

		mockMvc.perform(register(registration(email, "Ana", missing, "STUDENT")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[0].field").value("institutionId"));

		assertEquals(0, accountsWith(email));
	}

	@Test
	void otherIsAValidInstitutionWithoutFreeText() throws Exception {
		String email = uniqueEmail();
		Long id = registerAccount(email, "Ana", otherInstitution(jdbc), "STUDENT");

		mockMvc.perform(get("/api/accounts/me").with(signedInAs(id, email)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.institution.name").value("Otra"))
				.andExpect(jsonPath("$.institution.other").value(true));
	}

	// CA 2: la sesión y el inicio de sesión dan el nombre para la cabecera.

	@Test
	void loginAndSessionReturnTheNameReadFromTheDatabase() throws Exception {
		String email = uniqueEmail();
		registerAccount(email, "Ana Pérez", institutionId, "STUDENT");

		var login = mockMvc.perform(post("/api/session").with(csrf())
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.param("email", email)
				.param("password", PASSWORD))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Ana Pérez"))
				.andExpect(jsonPath("$.profileComplete").value(true))
				.andReturn();

		mockMvc.perform(get("/api/session").cookie(login.getResponse().getCookies()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Ana Pérez"))
				.andExpect(jsonPath("$.profileComplete").value(true));
	}

	// CA 6 y 8: las cuentas anteriores completan el perfil y dan la nueva
	// autorización en el mismo paso.

	@Test
	void anAccountCreatedBeforeTheProfileLogsInWithItIncomplete() throws Exception {
		String email = uniqueEmail();
		accountWithoutProfile(jdbc, email, Instant.now().minus(Duration.ofDays(3)));

		mockMvc.perform(post("/api/session").with(csrf())
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.param("email", email)
				.param("password", PASSWORD))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.profileComplete").value(false))
				.andExpect(jsonPath("$.name").doesNotExist());
	}

	@Test
	void completingTheProfileSavesItAndRenewsTheAuthorization() throws Exception {
		String email = uniqueEmail();
		Instant previousAuthorization = Instant.now().minus(Duration.ofDays(3));
		Long id = accountWithoutProfile(jdbc, email, previousAuthorization);

		mockMvc.perform(completeProfile(completion(" Luis  Gómez ", institutionId, "TEACHER", true))
				.with(signedInAs(id, email)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Luis Gómez"))
				.andExpect(jsonPath("$.profileComplete").value(true));

		Map<String, Object> account = storedAccount(email);
		assertEquals("Luis Gómez", account.get("name"));
		assertEquals(institutionId, ((Number) account.get("institution_id")).longValue());
		assertEquals("TEACHER", account.get("user_type"));
		Instant renewed = ((Timestamp) account.get("data_processing_authorized_at")).toInstant();
		assertTrue(renewed.isAfter(previousAuthorization));
	}

	@Test
	void anAccountThatNeverAuthorizedGivesTheAuthorizationWhenCompletingTheProfile() throws Exception {
		String email = uniqueEmail();
		Long id = accountWithoutProfile(jdbc, email, null);

		mockMvc.perform(completeProfile(completion("Luis", otherInstitution(jdbc), "STUDENT", true))
				.with(signedInAs(id, email)))
				.andExpect(status().isOk());

		assertNotNull(storedAccount(email).get("data_processing_authorized_at"));
	}

	@Test
	void withoutTheNewAuthorizationTheProfileIsNotSaved() throws Exception {
		String email = uniqueEmail();
		Long id = accountWithoutProfile(jdbc, email, null);

		mockMvc.perform(completeProfile(completion("Luis", institutionId, "STUDENT", false))
				.with(signedInAs(id, email)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.length()").value(1))
				.andExpect(jsonPath("$.errors[0].field").value("dataProcessingAuthorized"))
				.andExpect(jsonPath("$.errors[0].message").value(ProfileCompletionRequest.DATA_PROCESSING_MESSAGE));

		Map<String, Object> account = storedAccount(email);
		assertNull(account.get("name"));
		assertNull(account.get("data_processing_authorized_at"));
	}

	@Test
	void completingTheProfileWithAnInstitutionOutsideTheListIsRejected() throws Exception {
		String email = uniqueEmail();
		Long id = accountWithoutProfile(jdbc, email, null);
		Long missing = jdbc.sql("select coalesce(max(id), 0) + 1000 from institutions").query(Long.class).single();

		mockMvc.perform(completeProfile(completion("Luis", missing, "STUDENT", true)).with(signedInAs(id, email)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("institutionId"));

		assertNull(storedAccount(email).get("name"));
	}

	@Test
	void anAccountWithItsProfileCannotCompleteItAgain() throws Exception {
		String email = uniqueEmail();
		Long id = registerAccount(email, "Ana", institutionId, "STUDENT");

		mockMvc.perform(completeProfile(completion("Otro nombre", institutionId, "TEACHER", true))
				.with(signedInAs(id, email)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("PROFILE_ALREADY_COMPLETE"));

		assertEquals("Ana", storedAccount(email).get("name"));
	}

	@Test
	void completingTheProfileRequiresASession() throws Exception {
		mockMvc.perform(completeProfile(completion("Luis", institutionId, "STUDENT", true)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	// CA 3 y 7: el perfil reúne los datos de la cuenta y solo lo ve su dueño.

	@Test
	void theProfileRequiresASession() throws Exception {
		mockMvc.perform(get("/api/accounts/me"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	@Test
	void theProfileHasAllTheDataOfTheAccountWithTheSessionAndNoneOfAnother() throws Exception {
		String email = uniqueEmail();
		String otherEmail = uniqueEmail();
		Long id = registerAccount(email, "Ana Pérez", institutionId, "TEACHER");
		registerAccount(otherEmail, "Otra persona", institutionId, "STUDENT");
		String institutionName = jdbc.sql("select name from institutions where id = ?").param(institutionId)
				.query(String.class).single();

		mockMvc.perform(get("/api/accounts/me").with(signedInAs(id, email)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Ana Pérez"))
				.andExpect(jsonPath("$.email").value(email))
				.andExpect(jsonPath("$.institution.id").value(institutionId))
				.andExpect(jsonPath("$.institution.name").value(institutionName))
				.andExpect(jsonPath("$.institution.other").value(false))
				.andExpect(jsonPath("$.userType").value("TEACHER"))
				.andExpect(jsonPath("$.createdAt").isString())
				.andExpect(jsonPath("$.dataProcessingAuthorizedAt").isString())
				.andExpect(jsonPath("$.teamMember").value(false))
				.andExpect(jsonPath("$.passwordHash").doesNotExist())
				.andExpect(content().string(not(containsString(otherEmail))));
	}

	@Test
	void theDataAnOlderAccountDoesNotHaveArriveEmpty() throws Exception {
		String email = uniqueEmail();
		Long id = accountWithoutProfile(jdbc, email, null);

		mockMvc.perform(get("/api/accounts/me").with(signedInAs(id, email)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(email))
				.andExpect(jsonPath("$.createdAt").isString())
				.andExpect(jsonPath("$.name").doesNotExist())
				.andExpect(jsonPath("$.institution").doesNotExist())
				.andExpect(jsonPath("$.userType").doesNotExist())
				.andExpect(jsonPath("$.dataProcessingAuthorizedAt").doesNotExist());
	}

}
