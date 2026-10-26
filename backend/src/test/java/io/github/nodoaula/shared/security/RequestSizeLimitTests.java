package io.github.nodoaula.shared.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import io.github.nodoaula.shared.error.PayloadTooLargeException;

/**
 * Cubre el límite de tamaño del cuerpo de las peticiones: el que declara su
 * tamaño se rechaza sin leerlo, el que llega por partes se corta al leerlo, y
 * uno normal pasa intacto. El registro de cuentas sirve de ruta porque es
 * pública y lee JSON.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RequestSizeLimitTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private RequestSizeLimitFilter filter;

	@Test
	void rejectsADeclaredBodyOverTheLimit() throws Exception {
		mockMvc.perform(post("/api/accounts").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(registrationOfSize(RequestSizeLimitFilter.MAX_BODY_BYTES + 1)))
				.andExpect(status().isContentTooLarge())
				.andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
	}

	@Test
	void letsANormalBodyThrough() throws Exception {
		mockMvc.perform(post("/api/accounts").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"no-es-un-correo\",\"password\":\"una-contrasena\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
	}

	// Sin Content-Length no se puede rechazar antes de leer: el corte ocurre
	// en la lectura, en el byte que pasa del límite.
	@Test
	void cutsABodyWithoutContentLengthWhileReadingIt() {
		MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/accounts") {
			@Override
			public long getContentLengthLong() {
				return -1;
			}
		};
		request.setContent(new byte[(int) RequestSizeLimitFilter.MAX_BODY_BYTES + 1]);

		assertThrows(PayloadTooLargeException.class, () -> filter.doFilter(request, new MockHttpServletResponse(),
				(req, res) -> req.getInputStream().readAllBytes()));
	}

	// Un formulario multipart, como la subida de un apunte, lo limita Tomcat,
	// que guarda sus archivos en disco: el filtro lo deja pasar entero.
	@Test
	void letsAMultipartFormThroughWhateverItsSize() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/resources/documents");
		request.setContentType(MediaType.MULTIPART_FORM_DATA_VALUE + "; boundary=limite");
		request.setContent(new byte[(int) RequestSizeLimitFilter.MAX_BODY_BYTES + 1]);
		AtomicInteger bytesRead = new AtomicInteger();

		filter.doFilter(request, new MockHttpServletResponse(),
				(req, res) -> bytesRead.set(req.getInputStream().readAllBytes().length));

		assertEquals(RequestSizeLimitFilter.MAX_BODY_BYTES + 1, bytesRead.get());
	}

	private static byte[] registrationOfSize(long bytes) {
		String prefix = "{\"email\":\"no-es-un-correo\",\"password\":\"";
		String suffix = "\"}";
		return (prefix + "a".repeat((int) bytes - prefix.length() - suffix.length()) + suffix)
				.getBytes(StandardCharsets.UTF_8);
	}

}
