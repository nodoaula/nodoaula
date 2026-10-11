package io.github.nodoaula.shared.error;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * Un archivo que pasa de spring.servlet.multipart.max-file-size lo rechaza
 * Tomcat antes de llegar a ningún controlador, así que MockMvc no puede
 * provocarlo. Se prueba lo que es de NodoAula: que la excepción con que Spring
 * lo avisa salga como el mismo 413 que el filtro de tamaño.
 */
class MaxUploadSizeTests {

	@Test
	void aFileOverTheLimitGetsTheSamePayloadTooLargeResponse() {
		ResponseEntity<Object> response = new GlobalExceptionHandler().handleMaxUploadSizeExceededException(
				new MaxUploadSizeExceededException(20L * 1024 * 1024), new HttpHeaders(), HttpStatus.CONTENT_TOO_LARGE,
				new ServletWebRequest(new MockHttpServletRequest()));

		assertEquals(HttpStatus.CONTENT_TOO_LARGE, response.getStatusCode());
		ProblemDetail problem = (ProblemDetail) response.getBody();
		assertEquals("PAYLOAD_TOO_LARGE", problem.getProperties().get("code"));
	}

}
