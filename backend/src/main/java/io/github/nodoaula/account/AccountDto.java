package io.github.nodoaula.account;

/** Vista pública de una cuenta. Nunca incluye el hash de la contraseña. */
public record AccountDto(Long id, String email) {
}
