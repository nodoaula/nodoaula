package io.github.nodoaula.account;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Si no se puede comprobar el límite de HU508, no se deja pasar el intento. La
 * base caída no se puede provocar en una prueba, así que aquí se simula.
 */
@SpringBootTest
@AutoConfigureMockMvc
class LoginThrottleFailureTests {

	@Autowired private MockMvc mockMvc;

	@MockitoBean private LoginAttemptService loginAttempts;

	@Test
	void withoutTheDatabaseTheLoginAnswersAsUnavailableAndNotAsWrongCredentials() throws Exception {
		when(loginAttempts.claimAttempt(anyString())).thenThrow(new DataAccessResourceFailureException("Sin base"));

		mockMvc.perform(post("/api/session").with(csrf())
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.param("email", AccountTestSupport.uniqueEmail())
				.param("password", AccountTestSupport.PASSWORD))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_UNAVAILABLE"));
	}

}
