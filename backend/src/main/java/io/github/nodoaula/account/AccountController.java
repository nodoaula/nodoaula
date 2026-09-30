package io.github.nodoaula.account;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** El registro es público, pero exige el token CSRF como cualquier POST. */
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

}
