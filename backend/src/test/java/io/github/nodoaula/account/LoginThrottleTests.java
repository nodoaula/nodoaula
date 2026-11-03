package io.github.nodoaula.account;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTimeout;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pruebas de HU508 por la ruta: el contrato de la respuesta 429 y su lugar en la
 * cadena de Spring Security. Las cuentas y los correos son únicos en cada prueba
 * y se revierten al terminar, de modo que no dependen de lo que haya en la base.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LoginThrottleTests {

	private static final String PASSWORD = AccountTestSupport.PASSWORD;
	private static final String WRONG_PASSWORD = "otra-contrasena-distinta";
	private static final String TOO_MANY_ATTEMPTS = "\"TOO_MANY_LOGIN_ATTEMPTS\"";

	@Autowired private MockMvc mockMvc;
	@Autowired private JdbcClient jdbc;

	private String email;

	@BeforeEach
	void createAccount() {
		email = AccountTestSupport.uniqueEmail();
		AccountTestSupport.accountWithoutProfile(jdbc, email, Instant.now());
	}

	private MockHttpServletResponse login(String email, String password) throws Exception {
		return mockMvc.perform(post("/api/session").with(csrf())
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.param("email", email)
				.param("password", password))
				.andReturn().getResponse();
	}

	private void fail(String email, int times) throws Exception {
		for (int failure = 1; failure <= times; failure++) {
			assertEquals(401, login(email, WRONG_PASSWORD).getStatus(), "Fallo " + failure);
		}
	}

	private void endTheWait(String email) {
		jdbc.sql("update login_attempts set retry_at = ? where email_hash = ?")
				.param(Timestamp.from(Instant.now().minusSeconds(1)))
				.param(LoginAttemptService.hash(email))
				.update();
	}

	private static long retryAfter(MockHttpServletResponse response) {
		return Long.parseLong(response.getHeader(HttpHeaders.RETRY_AFTER));
	}

	@Test
	void fromTheSixthFailureOnEachAttemptIsRejectedWith429AndRetryAfter() throws Exception {
		fail(email, 6);

		mockMvc.perform(post("/api/session").with(csrf())
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.param("email", email)
				.param("password", WRONG_PASSWORD))
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code").value("TOO_MANY_LOGIN_ATTEMPTS"))
				.andExpect(jsonPath("$.status").value(429))
				.andExpect(jsonPath("$.detail").isNotEmpty());
	}

	@Test
	void retryAfterSaysTheSecondsLeftOfTheFirstWait() throws Exception {
		fail(email, 6);

		long seconds = retryAfter(login(email, WRONG_PASSWORD));

		assertTrue(seconds > 0 && seconds <= 30, "Retry-After: " + seconds);
	}

	@Test
	void duringTheWaitEvenTheCorrectPasswordIsRejectedAndNoSessionStarts() throws Exception {
		fail(email, 6);

		MockHttpServletResponse response = login(email, PASSWORD);

		assertEquals(429, response.getStatus());
		assertNull(response.getCookie("SESSION"));
	}

	@Test
	void theRequestIsRejectedRightAwayInsteadOfHeldForTheWait() throws Exception {
		fail(email, 6);

		MockHttpServletResponse response = assertTimeout(Duration.ofSeconds(5), () -> login(email, PASSWORD));

		assertEquals(429, response.getStatus());
		assertTrue(retryAfter(response) > 5, "La espera no pasó mientras se atendía la petición");
	}

	@Test
	void afterTheWaitTheAttemptIsEvaluatedAndRejectedOnesDidNotCount() throws Exception {
		fail(email, 6);
		for (int rejected = 0; rejected < 5; rejected++) {
			assertEquals(429, login(email, WRONG_PASSWORD).getStatus());
		}
		endTheWait(email);

		fail(email, 1);

		long seconds = retryAfter(login(email, WRONG_PASSWORD));
		assertTrue(seconds > 30 && seconds <= 60, "Con los cinco rechazos contados serían más. Retry-After: " + seconds);
	}

	@Test
	void theRejectionDoesNotMentionWhenTheCountRestarts() throws Exception {
		fail(email, 6);

		MockHttpServletResponse response = login(email, WRONG_PASSWORD);

		assertTrue(retryAfter(response) <= 900);
		assertFalse(response.getContentAsString().contains("hora"), response.getContentAsString());
	}

	@Test
	void afterTheWaitTheCorrectPasswordLogsIn() throws Exception {
		fail(email, 6);
		endTheWait(email);

		assertEquals(200, login(email, PASSWORD).getStatus());
	}

	@Test
	void aSuccessfulLoginRestartsTheCount() throws Exception {
		fail(email, 5);

		assertEquals(200, login(email, PASSWORD).getStatus());

		fail(email, 6);
		assertEquals(429, login(email, WRONG_PASSWORD).getStatus());
	}

	@Test
	void anEmailWithoutAnAccountGetsExactlyTheSameResponses() throws Exception {
		String unknown = AccountTestSupport.uniqueEmail();

		for (int attempt = 1; attempt <= 7; attempt++) {
			MockHttpServletResponse withAccount = login(email, WRONG_PASSWORD);
			MockHttpServletResponse withoutAccount = login(unknown, WRONG_PASSWORD);

			assertEquals(withAccount.getStatus(), withoutAccount.getStatus(), "Intento " + attempt);
			assertEquals(withAccount.getContentAsString(), withoutAccount.getContentAsString(), "Intento " + attempt);
		}
		assertTrue(login(unknown, WRONG_PASSWORD).getContentAsString().contains(TOO_MANY_ATTEMPTS));
	}

	@Test
	void changingHowTheEmailIsWrittenDoesNotDodgeTheLimit() throws Exception {
		// Todos entran en la misma cuenta. El carácter de control lo quita el
		// recorte del filtro de login, no la normalización del correo.
		String[] sameEmail = { email, email.toUpperCase(), "  " + email + " ", "\u0001" + email, email + "\t" };

		for (int failure = 1; failure <= 6; failure++) {
			assertEquals(401, login(sameEmail[failure % sameEmail.length], WRONG_PASSWORD).getStatus());
		}

		for (String variant : sameEmail) {
			assertEquals(429, login(variant, PASSWORD).getStatus(), "Variante: " + variant);
		}
	}

	@Test
	void theWaitOfOneEmailDoesNotAffectAnother() throws Exception {
		String other = AccountTestSupport.uniqueEmail();
		AccountTestSupport.accountWithoutProfile(jdbc, other, Instant.now());
		fail(email, 6);

		assertEquals(200, login(other, PASSWORD).getStatus());
	}

	@Test
	void aRequestWithoutTheCsrfTokenDoesNotCount() throws Exception {
		for (int attempt = 0; attempt < 10; attempt++) {
			mockMvc.perform(post("/api/session")
					.contentType(MediaType.APPLICATION_FORM_URLENCODED)
					.param("email", email)
					.param("password", WRONG_PASSWORD))
					.andExpect(status().isForbidden());
		}

		fail(email, 6);
	}

	@Test
	void otherOperationsOnTheSessionDoNotCount() throws Exception {
		for (int attempt = 0; attempt < 10; attempt++) {
			mockMvc.perform(get("/api/session").param("email", email))
					.andExpect(status().isUnauthorized());
		}

		fail(email, 6);
	}

	@Test
	void theAttemptsAreKeptInTheDatabase() throws Exception {
		fail(email, 3);

		int failures = jdbc.sql("select failures from login_attempts where email_hash = ?")
				.param(LoginAttemptService.hash(email))
				.query(Integer.class).single();

		assertEquals(3, failures);
	}

}
