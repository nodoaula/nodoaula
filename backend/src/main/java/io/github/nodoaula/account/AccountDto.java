package io.github.nodoaula.account;

/**
 * La cuenta con sesión, tal como la ve su dueño: lleva el correo, de modo que
 * solo se entrega a la propia cuenta (HU506). Nunca incluye el hash de la
 * contraseña. profileComplete en falso indica una cuenta anterior al perfil,
 * que tiene que completarlo; entonces name es null.
 */
public record AccountDto(Long id, String email, String name, boolean profileComplete) {
}
