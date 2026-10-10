package io.github.nodoaula.shared.security;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

import io.github.nodoaula.shared.error.PayloadTooLargeException;

/**
 * Rechaza con 413 toda petición cuyo cuerpo pase de 1 MB, antes de que nadie
 * lo lea. Sin este límite, un solo JSON de unos pocos MB enviado sin sesión
 * basta para dejar sin memoria la instancia de 512 MB de Render, que se
 * reinicia. Ningún formulario de NodoAula envía más de unos pocos KB.
 *
 * Va primero en la cadena, antes que Spring Security y la sesión. Un cuerpo
 * que declara su tamaño se rechaza sin leerlo; uno que llega por partes, sin
 * Content-Length, se corta al pasar el límite mientras se lee.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class RequestSizeLimitFilter extends OncePerRequestFilter {

	static final long MAX_BODY_BYTES = 1024L * 1024;

	private final HandlerExceptionResolver resolver;

	RequestSizeLimitFilter(@Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) {
		this.resolver = resolver;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {

		if (request.getContentLengthLong() > MAX_BODY_BYTES) {
			resolver.resolveException(request, response, null, new PayloadTooLargeException(MAX_BODY_BYTES));
			return;
		}
		chain.doFilter(new LimitedRequest(request), response);
	}

	private static final class LimitedRequest extends HttpServletRequestWrapper {

		private ServletInputStream limited;

		LimitedRequest(HttpServletRequest request) {
			super(request);
		}

		@Override
		public ServletInputStream getInputStream() throws IOException {
			if (limited == null) {
				limited = new LimitedInputStream(super.getInputStream());
			}
			return limited;
		}

		@Override
		public BufferedReader getReader() throws IOException {
			String encoding = getCharacterEncoding();
			Charset charset = encoding == null ? StandardCharsets.UTF_8 : Charset.forName(encoding);
			return new BufferedReader(new InputStreamReader(getInputStream(), charset));
		}

	}

	private static final class LimitedInputStream extends ServletInputStream {

		private final ServletInputStream delegate;
		private long consumed;

		LimitedInputStream(ServletInputStream delegate) {
			this.delegate = delegate;
		}

		@Override
		public int read() throws IOException {
			int value = delegate.read();
			if (value != -1) {
				count(1);
			}
			return value;
		}

		@Override
		public int read(byte[] buffer, int offset, int length) throws IOException {
			int n = delegate.read(buffer, offset, length);
			if (n > 0) {
				count(n);
			}
			return n;
		}

		private void count(int n) {
			consumed += n;
			if (consumed > MAX_BODY_BYTES) {
				throw new PayloadTooLargeException(MAX_BODY_BYTES);
			}
		}

		@Override
		public boolean isFinished() {
			return delegate.isFinished();
		}

		@Override
		public boolean isReady() {
			return delegate.isReady();
		}

		@Override
		public void setReadListener(ReadListener listener) {
			delegate.setReadListener(listener);
		}

	}

}
