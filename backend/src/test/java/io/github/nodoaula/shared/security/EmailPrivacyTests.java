package io.github.nodoaula.shared.security;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.json.JsonMapper;

/**
 * HU506, CA 7: el correo de una cuenta nunca se muestra a otras personas.
 * Quien publica una pregunta, responde y crea un grupo deja su rastro en lo
 * que ven los demás, y en nada de eso puede aparecer su correo: ni para una
 * cuenta que pertenece al grupo ni para un visitante sin sesión. Todo lo crea
 * la prueba, en un curso nuevo, de modo que no depende de lo que haya en la
 * base.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EmailPrivacyTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private JsonMapper jsonMapper;

	private static String unique(String text) {
		return text + " " + UUID.randomUUID().toString().substring(0, 8);
	}

	private Long newAccount(String email) {
		return jdbc.sql("insert into accounts (email, password_hash, created_at) values (?, '{noop}sin-uso', now()) "
				+ "returning id").param(email).query(Long.class).single();
	}

	private Long newCourse() {
		String name = unique("Curso de la prueba");
		return jdbc.sql("insert into courses (name, normalized_name) values (?, ?) returning id")
				.param(name).param(name.toLowerCase()).query(Long.class).single();
	}

	private static RequestPostProcessor signedInAs(Long accountId) {
		return authentication(new UsernamePasswordAuthenticationToken(new TestAccount(accountId), null, List.of()));
	}

	private Long createAndReadId(MockHttpServletRequestBuilder request) throws Exception {
		String body = mockMvc.perform(request).andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return jsonMapper.readTree(body).get("id").asLong();
	}

	private static MockHttpServletRequestBuilder postJson(String path, Long accountId, String json) {
		return post(path).with(signedInAs(accountId)).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(json);
	}

	@Test
	void theEmailOfWhoeverContributesNeverReachesOthers() throws Exception {
		String authorEmail = "autora." + UUID.randomUUID().toString().substring(0, 8) + "@ejemplo.com";
		Long author = newAccount(authorEmail);
		Long reader = newAccount("lectora." + UUID.randomUUID().toString().substring(0, 8) + "@ejemplo.com");
		Long courseId = newCourse();

		Long questionId = createAndReadId(postJson("/api/forum/questions", author,
				"{\"courseId\": %s, \"title\": \"Una duda\", \"body\": \"¿Cómo se resuelve?\"}".formatted(courseId)));
		createAndReadId(postJson("/api/forum/questions/" + questionId + "/answers", author,
				"{\"body\": \"Así se resuelve.\"}"));
		Long groupId = createAndReadId(postJson("/api/study-groups", author,
				"{\"courseId\": %s, \"name\": \"%s\"}".formatted(courseId, unique("Grupo"))));
		mockMvc.perform(post("/api/study-groups/" + groupId + "/members").with(signedInAs(reader)).with(csrf()))
				.andExpect(status().isCreated());

		List<String> paths = List.of(
				"/api/forum/questions?courseId=" + courseId,
				"/api/forum/questions/" + questionId,
				"/api/forum/questions/" + questionId + "/answers",
				"/api/study-groups?courseId=" + courseId);

		for (String path : paths) {
			mockMvc.perform(get(path))
					.andExpect(status().isOk())
					.andExpect(content().string(not(containsString(authorEmail))));
			mockMvc.perform(get(path).with(signedInAs(reader)))
					.andExpect(status().isOk())
					.andExpect(content().string(not(containsString(authorEmail))));
		}

		// La lista de miembros la ve solo quien pertenece al grupo, y tampoco
		// lleva el correo de los demás miembros.
		mockMvc.perform(get("/api/study-groups/" + groupId + "/members").with(signedInAs(reader)))
				.andExpect(status().isOk())
				.andExpect(content().string(not(containsString(authorEmail))));
	}

	/**
	 * Hace de cuenta con sesión iniciada. Los controladores leen la cuenta con
	 * @AuthenticationPrincipal(expression = "id"), por reflexión.
	 */
	public static final class TestAccount {

		private final Long id;

		TestAccount(Long id) {
			this.id = id;
		}

		public Long getId() {
			return id;
		}

	}

}
