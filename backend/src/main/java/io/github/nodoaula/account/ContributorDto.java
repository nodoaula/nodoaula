package io.github.nodoaula.account;

/**
 * Quien aportó un recurso, tal como lo ve cualquiera (HU507): la ficha de
 * usuario, que no es el perfil de la cuenta. Solo lleva el nombre, el tipo de
 * usuario y la institución; nunca el correo ni el identificador de la cuenta.
 *
 * name en null es un aporte sin nombre que mostrar: del equipo sin una cuenta
 * de autor o desde una cuenta de prueba («Equipo de NodoAula»), o de una
 * cuenta que aún no ha completado su perfil («Miembro de la comunidad»).
 * Entonces userType e institution también llegan en null. institution llega
 * en null también cuando es «Otra».
 */
public record ContributorDto(
		ContributorOrigin origin,
		String name,
		UserType userType,
		String institution) {

	static final ContributorDto TEAM = new ContributorDto(ContributorOrigin.TEAM, null, null, null);

	static final ContributorDto COMMUNITY_MEMBER = new ContributorDto(ContributorOrigin.COMMUNITY, null, null, null);

}
