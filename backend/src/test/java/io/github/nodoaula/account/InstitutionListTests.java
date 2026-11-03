package io.github.nodoaula.account;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashSet;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Pruebas de la lista cerrada de instituciones de HU506 (CA 4). Miran
 * propiedades de la lista y no su tamaño, que cambiaría si alguien añade una
 * institución a la base local.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class InstitutionListTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private JsonMapper jsonMapper;

	private List<InstitutionDto> listWithoutSession() throws Exception {
		String body = mockMvc.perform(get("/api/institutions"))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		return jsonMapper.readValue(body, new TypeReference<List<InstitutionDto>>() {
		});
	}

	@Test
	void theListIsPublicAndOtherIsTheLastAndOnlyOptionWithoutCode() throws Exception {
		List<InstitutionDto> institutions = listWithoutSession();

		InstitutionDto last = institutions.getLast();
		assertEquals("Otra", last.name());
		assertTrue(last.other());
		assertEquals(1, institutions.stream().filter(InstitutionDto::other).count());
	}

	@Test
	void eachInstitutionAppearsOnceEvenIfItHasBranches() throws Exception {
		List<InstitutionDto> institutions = listWithoutSession();

		List<String> names = institutions.stream().map(InstitutionDto::name).toList();
		assertEquals(names.size(), new HashSet<>(names).size());
		// En el SNIES tiene una fila por cada seccional; en la lista, una.
		assertEquals(1, names.stream().filter("UNIVERSIDAD DE ANTIOQUIA"::equals).count());
	}

	@Test
	void everyInstitutionOfTheTableIsListedBeforeOther() throws Exception {
		Long id = AccountTestSupport.newInstitution(jdbc);
		String name = jdbc.sql("select name from institutions where id = ?").param(id).query(String.class).single();

		List<InstitutionDto> institutions = listWithoutSession();

		int index = institutions.stream().map(InstitutionDto::id).toList().indexOf(id);
		assertTrue(index >= 0 && index < institutions.size() - 1);
		assertEquals(name, institutions.get(index).name());
		assertFalse(institutions.get(index).other());
	}

	@Test
	void theTableAdmitsASingleOptionWithoutCode() {
		assertEquals(1, jdbc.sql("select count(*) from institutions where snies_code is null")
				.query(Long.class).single());
		assertTrue(jdbc.sql("select count(*) from institutions where snies_code is not null")
				.query(Long.class).single() > 0);
	}

}
