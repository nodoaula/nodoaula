package io.github.nodoaula.account;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Dice al frontend, al cargar, si hay una sesión iniciada y de quién es. Es
 * una ruta protegida: sin sesión responde 401 como cualquier otra.
 *
 * Iniciar y cerrar sesión no pasan por aquí: los atienden los filtros de login
 * y logout de Spring Security en esta misma ruta, antes de llegar a un
 * controlador (shared/security).
 */
@RestController
@RequestMapping("/api/session")
class SessionController {

	@GetMapping
	AccountDto currentAccount(@AuthenticationPrincipal AccountPrincipal principal) {
		return principal.toDto();
	}

}
