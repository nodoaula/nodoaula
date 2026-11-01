package io.github.nodoaula.account;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** La lista de instituciones es pública: el registro la necesita sin sesión. */
@RestController
@RequestMapping("/api/institutions")
class InstitutionController {

	private final AccountService accountService;

	InstitutionController(AccountService accountService) {
		this.accountService = accountService;
	}

	@GetMapping
	List<InstitutionDto> listInstitutions() {
		return accountService.listInstitutions();
	}

}
