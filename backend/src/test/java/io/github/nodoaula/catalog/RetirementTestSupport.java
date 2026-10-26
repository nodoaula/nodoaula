package io.github.nodoaula.catalog;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

import java.time.LocalDate;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import io.github.nodoaula.catalog.ResourceEntryMethodTests.TestAuthor;

/** Lo que comparten las pruebas del retiro de un recurso (historia HU307). */
final class RetirementTestSupport {

	static final Long AUTHOR_ID = 999L;
	static final Long OTHER_ID = 998L;
	static final String SEED_TITLE = "Spring Boot 2026-2";

	private RetirementTestSupport() {
	}

	static RequestPostProcessor signedInAs(Long accountId) {
		return authentication(new UsernamePasswordAuthenticationToken(new TestAuthor(accountId), null, List.of()));
	}

	// La marca solo se pone en la base de datos, como en el entorno desplegado
	// (ADR-007): no hay pantalla ni endpoint para ponerla.
	static Long teamAccount(JdbcTemplate jdbcTemplate, String email) {
		return jdbcTemplate.queryForObject(
				"insert into accounts (email, password_hash, created_at, team_member) "
						+ "values (?, '{noop}sin-uso', now(), true) returning id",
				Long.class, email);
	}

	static Long registerVideo(ResourceService resourceService, String title, String videoId, String course,
			List<String> topics) {
		return resourceService.createResource(new CreateResourceRequest(
				title,
				null,
				LocalDate.of(2026, 10, 1),
				600,
				null,
				"https://www.youtube.com/watch?v=" + videoId,
				ResourceType.VIDEO,
				course,
				topics), AUTHOR_ID).id();
	}

	static Long seedResourceId(ResourceRepository resourceRepository) {
		return resourceRepository.findAll().stream()
				.filter(resource -> resource.getTitle().equals(SEED_TITLE))
				.findFirst()
				.orElseThrow()
				.getId();
	}

}
