package io.github.nodoaula.account;

import java.io.IOException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import tools.jackson.databind.json.JsonMapper;

/**
 * Responde al inicio de sesión correcto con un 200 y la cuenta, en lugar de la
 * redirección que hace el filtro de login por defecto: por la reescritura del
 * sitio estático, una redirección acabaría devolviendo el HTML del frontend.
 */
@Component
class LoginSuccessHandler implements AuthenticationSuccessHandler {

	private final JsonMapper jsonMapper;

	LoginSuccessHandler(JsonMapper jsonMapper) {
		this.jsonMapper = jsonMapper;
	}

	@Override
	public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
			Authentication authentication) throws IOException {
		AccountPrincipal principal = (AccountPrincipal) authentication.getPrincipal();

		response.setStatus(HttpStatus.OK.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		jsonMapper.writeValue(response.getOutputStream(), principal.toDto());
	}

}
