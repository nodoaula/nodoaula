package io.github.nodoaula.account;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pruebas de HU309: registro, inicio y cierre de sesión contra la base real.
 * Cada caso es un contrato de la API: el código de estado y el código de error
 * que recibe el frontend.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SessionFlowTests {

	private static final String EMAIL = "sesion.prueba@ejemplo.com";
	private static final String PASSWORD = "una-contrasena-valida";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcClient jdbc;

	private static String registration(String email, String password) {
		return "{\"email\":\"%s\",\"password\":\"%s\",\"dataProcessingAuthorized\":true}".formatted(email, password);
	}

	private void register(String email, String password) throws Exception {
		mockMvc.perform(post("/api/accounts").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(registration(email, password)))
				.andExpect(status().isCreated());
	}

	private MvcResult login(String email, String password) throws Exception {
		return mockMvc.perform(post("/api/session").with(csrf())
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.param("email", email)
				.param("password", password))
				.andReturn();
	}

	private static Cookie[] cookiesOf(MvcResult result) {
		return result.getResponse().getCookies();
	}

	@Test
	void registersAnAccountAndNeverReturnsThePassword() throws Exception {
		mockMvc.perform(post("/api/accounts").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(registration(EMAIL, PASSWORD)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.email").value(EMAIL))
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.password").doesNotExist())
				.andExpect(jsonPath("$.passwordHash").doesNotExist());
	}

	@Test
	void aRepeatedEmailIsRejectedEvenWithOtherCapitalization() throws Exception {
		register(EMAIL, PASSWORD);

		mockMvc.perform(post("/api/accounts").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(registration(EMAIL.toUpperCase(), PASSWORD)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EMAIL_ALREADY_IN_USE"));
	}

	@Test
	void invalidRegistrationDataIsRejectedOnTheField() throws Exception {
		mockMvc.perform(post("/api/accounts").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(registration("no-es-un-correo", "corta")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors.length()").value(2));
	}

	@Test
	void recordsWhenTheAccountAuthorizedTheProcessingOfItsData() throws Exception {
		register(EMAIL, PASSWORD);

		var dates = jdbc.sql("select created_at, data_processing_authorized_at from accounts where email = ?")
				.param(EMAIL)
				.query((row, index) -> new Object[] { row.getObject(1), row.getObject(2) })
				.single();
		assertNotNull(dates[1]);
		assertEquals(dates[0], dates[1]);
	}

	@Test
	void withoutTheAuthorizationTheAccountIsNotCreated() throws Exception {
		for (String authorization : new String[] { "", ",\"dataProcessingAuthorized\":false" }) {
			mockMvc.perform(post("/api/accounts").with(csrf())
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\"" + authorization + "}"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errors.length()").value(1))
					.andExpect(jsonPath("$.errors[0].field").value("dataProcessingAuthorized"))
					.andExpect(jsonPath("$.errors[0].message").value(RegistrationRequest.DATA_PROCESSING_MESSAGE));
		}

		assertEquals(0, jdbc.sql("select count(*) from accounts where email = ?").param(EMAIL)
				.query(Long.class).single());
	}

	@Test
	void logsInWithTheRegisteredCredentialsAndTheSessionIdentifiesTheAccount() throws Exception {
		register(EMAIL, PASSWORD);

		MvcResult login = login(EMAIL, PASSWORD);
		assertEquals(200, login.getResponse().getStatus());

		mockMvc.perform(get("/api/session").cookie(cookiesOf(login)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(EMAIL));
	}

	@Test
	void theEmailAtLoginIsNotCaseSensitive() throws Exception {
		register(EMAIL, PASSWORD);

		assertEquals(200,
				login(EMAIL.toUpperCase(), PASSWORD).getResponse().getStatus());
	}

	@Test
	void aWrongPasswordAndAnUnknownEmailGetTheSameError() throws Exception {
		register(EMAIL, PASSWORD);

		for (MvcResult result : new MvcResult[] {
				login(EMAIL, "otra-contrasena-distinta"),
				login("nadie@ejemplo.com", PASSWORD) }) {
			assertEquals(401, result.getResponse().getStatus());
			assertTrue(
					result.getResponse().getContentAsString().contains("\"INVALID_CREDENTIALS\""));
		}
	}

	@Test
	void withoutASessionTheCurrentAccountIsDenied() throws Exception {
		mockMvc.perform(get("/api/session"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	@Test
	void logoutRespondsNoContentAndTheSessionStopsWorking() throws Exception {
		register(EMAIL, PASSWORD);
		MvcResult login = login(EMAIL, PASSWORD);
		Cookie[] session = cookiesOf(login);

		mockMvc.perform(delete("/api/session").with(csrf()).cookie(session))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/session").cookie(session))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	@Test
	void aPostWithoutTheCsrfTokenIsForbidden() throws Exception {
		mockMvc.perform(post("/api/accounts")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\"}"))
				.andExpect(status().isForbidden());
	}

}
