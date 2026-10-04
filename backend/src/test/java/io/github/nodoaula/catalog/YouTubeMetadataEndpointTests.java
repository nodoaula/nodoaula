package io.github.nodoaula.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cubre el contrato HTTP de GET /api/resources/youtube-metadata (historia
 * HU202): la respuesta completa, los campos ausentes, los tres rechazos con
 * su código, la sesión obligatoria y que consultar no crea ningún recurso.
 *
 * Solo se sustituye la frontera con YouTube, la interfaz
 * VideoMetadataProvider (ADR-009): controlador, servicio, seguridad, mapeo de
 * errores y base de datos son los reales.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class YouTubeMetadataEndpointTests {

	private static final String URL = "/api/resources/youtube-metadata";
	private static final String VIDEO_ID = "S0TC_HDfKvA";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ResourceRepository resourceRepository;

	@MockitoBean
	private VideoMetadataProvider videoMetadataProvider;

	@Test
	void returnsTheVideoDataWithTheCanonicalLink() throws Exception {
		when(videoMetadataProvider.fetch(VIDEO_ID)).thenReturn(new VideoMetadata(
				"Harness Engineering", "Introducción a Harness.", LocalDate.of(2026, 9, 10), 7230,
				"Fábrica Escuela - Canal de Formación"));

		mockMvc.perform(get(URL).param("url", "https://youtu.be/" + VIDEO_ID + "?t=5").with(user("aporte@ejemplo.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.videoId").value(VIDEO_ID))
				.andExpect(jsonPath("$.url").value("https://www.youtube.com/watch?v=" + VIDEO_ID))
				.andExpect(jsonPath("$.title").value("Harness Engineering"))
				.andExpect(jsonPath("$.description").value("Introducción a Harness."))
				.andExpect(jsonPath("$.publishedAt").value("2026-09-10"))
				.andExpect(jsonPath("$.durationSeconds").value(7230))
				.andExpect(jsonPath("$.channel").value("Fábrica Escuela - Canal de Formación"))
				.andExpect(jsonPath("$.missingFields.length()").value(0));
	}

	@Test
	void acceptsALooseVideoId() throws Exception {
		when(videoMetadataProvider.fetch(VIDEO_ID)).thenReturn(new VideoMetadata(
				"Título", null, LocalDate.of(2026, 9, 10), 60, "Canal"));

		mockMvc.perform(get(URL).param("url", VIDEO_ID).with(user("aporte@ejemplo.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.url").value("https://www.youtube.com/watch?v=" + VIDEO_ID));
	}

	@Test
	void listsTheFieldsYouTubeDidNotReturnWithTheFormNames() throws Exception {
		when(videoMetadataProvider.fetch(VIDEO_ID)).thenReturn(new VideoMetadata(
				"Solo título", null, null, null, null));

		mockMvc.perform(get(URL).param("url", VIDEO_ID).with(user("aporte@ejemplo.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("Solo título"))
				.andExpect(jsonPath("$.description").doesNotExist())
				.andExpect(jsonPath("$.missingFields.length()").value(4))
				.andExpect(jsonPath("$.missingFields[0]").value("description"))
				.andExpect(jsonPath("$.missingFields[1]").value("publishedAt"))
				.andExpect(jsonPath("$.missingFields[2]").value("durationSeconds"))
				.andExpect(jsonPath("$.missingFields[3]").value("channel"));
	}

	@Test
	void rejectsALinkWithoutAYouTubeIdWithoutCallingYouTube() throws Exception {
		mockMvc.perform(get(URL).param("url", "https://vimeo.com/76979871").with(user("aporte@ejemplo.com")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_VIDEO_LINK"));

		mockMvc.perform(get(URL).param("url", "   ").with(user("aporte@ejemplo.com")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_VIDEO_LINK"));

		mockMvc.perform(get(URL).with(user("aporte@ejemplo.com")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_VIDEO_LINK"));

		verify(videoMetadataProvider, never()).fetch(anyString());
	}

	@Test
	void respondsNotFoundForAMissingPrivateOrDeletedVideo() throws Exception {
		when(videoMetadataProvider.fetch(VIDEO_ID)).thenThrow(new VideoNotFoundException());

		mockMvc.perform(get(URL).param("url", VIDEO_ID).with(user("aporte@ejemplo.com")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("VIDEO_NOT_FOUND"));
	}

	@Test
	void respondsUnavailableWhenYouTubeCannotBeQueried() throws Exception {
		when(videoMetadataProvider.fetch(VIDEO_ID)).thenThrow(new VideoMetadataUnavailableException(null));

		mockMvc.perform(get(URL).param("url", VIDEO_ID).with(user("aporte@ejemplo.com")))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("VIDEO_METADATA_UNAVAILABLE"));
	}

	// Protege la regla de SecurityConfig que va antes de la que deja público
	// todo GET /api/resources/**: si se movieran, cualquiera gastaría la cuota.
	@Test
	void requiresASessionAndDoesNotCallYouTubeWithoutOne() throws Exception {
		mockMvc.perform(get(URL).param("url", VIDEO_ID))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

		verify(videoMetadataProvider, never()).fetch(anyString());
	}

	@Test
	void consultingAVideoDoesNotCreateAnyResource() throws Exception {
		when(videoMetadataProvider.fetch(VIDEO_ID)).thenReturn(new VideoMetadata(
				"Título", "Descripción", LocalDate.of(2026, 9, 10), 60, "Canal"));
		long resourcesBefore = resourceRepository.count();

		mockMvc.perform(get(URL).param("url", VIDEO_ID).with(user("aporte@ejemplo.com")))
				.andExpect(status().isOk());

		assertEquals(resourcesBefore, resourceRepository.count());
	}

}
