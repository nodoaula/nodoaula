package io.github.nodoaula.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.MigrationScripts;

/**
 * HU507: la ficha de un recurso dice quién lo aportó y cuándo. Cada prueba
 * crea sus cuentas, su institución, su curso y sus recursos, con nombres,
 * correos y videos únicos, de modo que no depende de lo que haya en la base.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResourceContributorTests {

	// El catálogo semilla y lo que el equipo cargó sin cuenta: ninguna tiene
	// este identificador, porque la tabla los genera desde 1.
	private static final long NO_ACCOUNT = 0L;

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ResourceService resourceService;

	@Autowired
	private ResourceRepository resourceRepository;

	@Autowired
	private CourseRepository courseRepository;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private EntityManager entityManager;

	private static String unique(String text) {
		return text + " " + UUID.randomUUID().toString().substring(0, 8);
	}

	private static String uniqueEmail() {
		return "aporte." + UUID.randomUUID().toString().substring(0, 8) + "@ejemplo.com";
	}

	// Una institución nueva, con un código negativo que el SNIES no usa, para
	// no depender de las que cargó la migración.
	private Long newInstitution(String name) {
		return jdbc.sql("insert into institutions (snies_code, name) values (?, ?) returning id")
				.param(-(UUID.randomUUID().hashCode() & Integer.MAX_VALUE) - 1)
				.param(name)
				.query(Long.class).single();
	}

	private Long otherInstitution() {
		return jdbc.sql("select id from institutions where snies_code is null").query(Long.class).single();
	}

	// Una cuenta creada hoy, con la autorización en el mismo instante, como
	// las crea el registro desde HU510.
	private Long accountWithProfile(String email, String name, Long institutionId, String userType) {
		return jdbc.sql("""
				insert into accounts (email, password_hash, created_at, data_processing_authorized_at,
				                      name, institution_id, user_type)
				values (?, '{noop}sin-uso', now(), now(), ?, ?, ?) returning id""")
				.param(email).param(name).param(institutionId).param(userType)
				.query(Long.class).single();
	}

	private Long accountWithoutProfile(String email) {
		return jdbc.sql("""
				insert into accounts (email, password_hash, created_at, data_processing_authorized_at)
				values (?, '{noop}sin-uso', now(), now()) returning id""")
				.param(email).query(Long.class).single();
	}

	private void mark(Long accountId, String column) {
		jdbc.sql("update accounts set " + column + " = true where id = ?").param(accountId).update();
	}

	private Long newVideo(Long authorId) {
		String videoId = UUID.randomUUID().toString().replace("-", "").substring(0, 11);
		return resourceService.createResource(new CreateResourceRequest(
				unique("Video de la prueba del aporte"),
				null,
				LocalDate.of(2026, 9, 1),
				600,
				null,
				"https://www.youtube.com/watch?v=" + videoId,
				ResourceType.VIDEO,
				unique("Curso de la prueba del aporte"),
				List.of("Tema del aporte")), authorId).id();
	}

	private Long newDocument(Long authorId, LocalDate uploadedOn) {
		Course course = courseRepository.save(new Course(unique("Curso de la prueba del apunte")));
		return resourceRepository.saveAndFlush(Resource.document(unique("Apunte de la prueba del aporte"), null,
				uploadedOn, course, authorId, new DocumentFile(unique("aporte") + ".pdf", 1_000, 2))).getId();
	}

	private ResultActions detail(Long resourceId) throws Exception {
		return mockMvc.perform(get("/api/resources/" + resourceId)).andExpect(status().isOk());
	}

	// CA 1 y 5: nombre, tipo de usuario e institución de quien lo aportó, en un
	// video y en un apunte, y nada más: ni el correo ni la cuenta.
	@Test
	void aContributionShowsTheNameUserTypeAndInstitutionButNeverTheEmail() throws Exception {
		String email = uniqueEmail();
		String institution = unique("Universidad de la prueba");
		Long author = accountWithProfile(email, "Ana Pérez", newInstitution(institution), "TEACHER");

		for (Long resourceId : List.of(newVideo(author), newDocument(author, LocalDate.of(2026, 10, 6)))) {
			detail(resourceId)
					.andExpect(jsonPath("$.contributor.origin").value("COMMUNITY"))
					.andExpect(jsonPath("$.contributor.name").value("Ana Pérez"))
					.andExpect(jsonPath("$.contributor.userType").value("TEACHER"))
					.andExpect(jsonPath("$.contributor.institution").value(institution))
					.andExpect(jsonPath("$.contributor.email").doesNotExist())
					.andExpect(jsonPath("$.contributor.id").doesNotExist())
					.andExpect(jsonPath("$.authorId").doesNotExist())
					.andExpect(content().string(not(containsString(email))));
		}
	}

	// CA 1: «Otra» no dice nada de la institución; se muestran el nombre y el tipo.
	@Test
	void anOtherInstitutionIsNotShown() throws Exception {
		Long author = accountWithProfile(uniqueEmail(), "Luis Gómez", otherInstitution(), "STUDENT");

		detail(newVideo(author))
				.andExpect(jsonPath("$.contributor.name").value("Luis Gómez"))
				.andExpect(jsonPath("$.contributor.userType").value("STUDENT"))
				.andExpect(jsonPath("$.contributor.institution").value(nullValue()));
	}

	// CA 2: lo que cargó el equipo sin una cuenta de autor es del equipo.
	@Test
	void aContributionWithoutAnAuthorAccountIsFromTheTeam() throws Exception {
		detail(newVideo(NO_ACCOUNT))
				.andExpect(jsonPath("$.contributor.origin").value("TEAM"))
				.andExpect(jsonPath("$.contributor.name").value(nullValue()))
				.andExpect(jsonPath("$.contributor.userType").value(nullValue()))
				.andExpect(jsonPath("$.contributor.institution").value(nullValue()));
	}

	// CA 2: una cuenta que aún no ha completado su perfil es un miembro de la
	// comunidad sin nombre.
	@Test
	void anAccountWithoutProfileIsACommunityMemberWithoutName() throws Exception {
		String email = uniqueEmail();
		Long author = accountWithoutProfile(email);

		detail(newVideo(author))
				.andExpect(jsonPath("$.contributor.origin").value("COMMUNITY"))
				.andExpect(jsonPath("$.contributor.name").value(nullValue()))
				.andExpect(jsonPath("$.contributor.userType").value(nullValue()))
				.andExpect(content().string(not(containsString(email))));
	}

	// CA 4: lo aportado desde una cuenta de prueba es del equipo, como el
	// catálogo semilla, aunque la cuenta tenga perfil.
	@Test
	void aTeamTestAccountContributesAsTheTeamWithoutName() throws Exception {
		Long author = accountWithProfile(uniqueEmail(), "Cuenta de prueba", otherInstitution(), "STUDENT");
		mark(author, "team_test_account");

		detail(newVideo(author))
				.andExpect(jsonPath("$.contributor.origin").value("TEAM"))
				.andExpect(jsonPath("$.contributor.name").value(nullValue()))
				.andExpect(jsonPath("$.contributor.userType").value(nullValue()));
	}

	// CA 3: una cuenta del equipo (ADR-007) con perfil se distingue de la
	// comunidad, con su nombre.
	@Test
	void aTeamMemberContributesAsTheTeamWithItsName() throws Exception {
		String institution = unique("Universidad del equipo");
		Long author = accountWithProfile(uniqueEmail(), "Marta Ruiz", newInstitution(institution), "STUDENT");
		mark(author, "team_member");

		detail(newVideo(author))
				.andExpect(jsonPath("$.contributor.origin").value("TEAM"))
				.andExpect(jsonPath("$.contributor.name").value("Marta Ruiz"))
				.andExpect(jsonPath("$.contributor.institution").value(institution));
	}

	// CA 6: un recurso nuevo guarda el día en que se aportó; un apunte, el de
	// su subida.
	@Test
	void aNewResourceKeepsTheDayItWasContributed() throws Exception {
		Long author = accountWithoutProfile(uniqueEmail());

		detail(newVideo(author))
				.andExpect(jsonPath("$.contributedOn").value(LocalDate.now(ZoneId.of("America/Bogota")).toString()));
		detail(newDocument(author, LocalDate.of(2026, 10, 6)))
				.andExpect(jsonPath("$.contributedOn").value("2026-10-06"));
	}

	// CA 6: los apuntes que ya existían toman su fecha de subida, y los videos
	// anteriores a la historia se quedan sin fecha. Se borra la de un apunte y
	// un video creados por la prueba, como estaban antes de la migración, y se
	// aplica su update.
	@Test
	void theMigrationDatesExistingDocumentsAndLeavesExistingVideosWithoutADate() throws Exception {
		Long video = newVideo(NO_ACCOUNT);
		Long document = newDocument(NO_ACCOUNT, LocalDate.of(2026, 10, 20));
		entityManager.flush();
		jdbc.sql("update resources set contributed_on = null where id in (?, ?)").param(video).param(document)
				.update();

		jdbc.sql(MigrationScripts.updateStatementOf("V202611011900__add_resource_contributed_on.sql")).update();
		// La ficha se lee de la base, no de los recursos que la prueba acaba de crear.
		entityManager.clear();

		detail(document).andExpect(jsonPath("$.contributedOn").value("2026-10-20"));
		detail(video).andExpect(jsonPath("$.contributedOn").value(nullValue()));
	}

	// Lo retirado por moderación no dice quién lo aportó (HU307).
	@Test
	void aRetiredResourceDoesNotSayWhoContributedIt() throws Exception {
		Long author = accountWithProfile(uniqueEmail(), "Pedro Díaz", otherInstitution(), "STUDENT");
		Long resourceId = newVideo(author);
		resourceService.retireResource(resourceId, author);

		detail(resourceId)
				.andExpect(jsonPath("$.retired").value(true))
				.andExpect(jsonPath("$.contributor").value(nullValue()))
				.andExpect(jsonPath("$.contributedOn").value(nullValue()))
				.andExpect(content().string(not(containsString("Pedro Díaz"))));
	}

	// La ficha de usuario se ve igual con sesión: no es el perfil de la cuenta,
	// y ni su dueño recibe ahí su correo.
	@Test
	void theAuthorSeesTheSameContributorCardWithoutTheEmail() throws Exception {
		String email = uniqueEmail();
		Long author = accountWithProfile(email, "Sofía León", otherInstitution(), "STUDENT");
		Long resourceId = newVideo(author);

		String body = mockMvc.perform(get("/api/resources/" + resourceId)
				.with(authentication(new UsernamePasswordAuthenticationToken(new SignedInAccount(author), null,
						List.of()))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.contributor.name").value("Sofía León"))
				.andReturn().getResponse().getContentAsString();

		assertThat(body).doesNotContain(email);
	}

	// Lo que lee @AuthenticationPrincipal(expression = "id") en el controlador.
	record SignedInAccount(Long id) {
	}

}
