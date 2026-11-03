import { userTypeLabel } from '../account/profile.js'

export const TEAM_LABEL = 'Equipo de NodoAula'
export const COMMUNITY_MEMBER_LABEL = 'Miembro de la comunidad'
const COMMUNITY_LABEL = 'Comunidad'

/**
 * Lo que dice la ficha de usuario de quien aportó un recurso (HU507). Sin
 * nombre, el aporte es del equipo sin una cuenta de autor o desde una cuenta
 * de prueba, o de una cuenta que aún no completó su perfil: el nombre se
 * sustituye por «Equipo de NodoAula» o «Miembro de la comunidad», que ya dicen
 * de dónde viene. Con nombre, `origin` lo dice aparte. `details` son el tipo
 * de usuario y la institución, que la API no envía cuando es «Otra».
 */
export function describeContributor(contributor) {
  const team = contributor.origin === 'TEAM'

  if (contributor.name == null) {
    return { team, name: team ? TEAM_LABEL : COMMUNITY_MEMBER_LABEL, details: [], origin: null }
  }

  return {
    team,
    name: contributor.name,
    details: [userTypeLabel(contributor.userType), contributor.institution].filter(Boolean),
    origin: team ? TEAM_LABEL : COMMUNITY_LABEL,
  }
}
