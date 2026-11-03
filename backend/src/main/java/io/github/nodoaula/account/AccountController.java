package io.github.nodoaula.account;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * El registro es público, pero exige el token CSRF como cualquier POST. El
 * perfil es solo de la cuenta con sesión: /me, y no un identificador, para que
 * no exista forma de pedir el de otra cuenta (HU506).
 */
@RestController
@RequestMapping("/api/accounts")
class AccountController {

	private final AccountService accountService;

	AccountController(AccountService accountService) {
		this.accountService = accountService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	AccountDto register(@Valid @RequestBody RegistrationRequest request) {
		return accountService.register(request);
	}

	@GetMapping("/me")
	AccountProfileDto profile(@AuthenticationPrincipal(expression = "id") Long accountId) {
		return accountService.profile(accountId);
	}

	@PutMapping("/me/profile")
	AccountDto completeProfile(@Valid @RequestBody ProfileCompletionRequest request,
			@AuthenticationPrincipal(expression = "id") Long accountId) {
		return accountService.completeProfile(accountId, request);
	}

}
