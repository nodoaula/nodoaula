package io.github.nodoaula.shared.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * El frontend lo llama al cargar, antes de cualquier petición que modifique
 * datos. Spring Security genera el token de forma diferida y solo escribe la
 * cookie cuando alguien lo lee; esta ruta existe para leerlo. El token viaja
 * en la cookie, no en el cuerpo.
 */
@RestController
class CsrfController {

	@GetMapping("/api/csrf")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void csrf(CsrfToken token) {
		token.getToken();
	}

}
