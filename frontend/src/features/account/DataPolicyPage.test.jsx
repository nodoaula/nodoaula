import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import DataPolicyPage from './DataPolicyPage.jsx'

describe('DataPolicyPage', () => {
  afterEach(cleanup)

  it('dice a quién escribir para ejercer los derechos', () => {
    render(<DataPolicyPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Política de tratamiento de datos' })).toBeInTheDocument()
    const contacts = screen.getAllByRole('link', { name: 'brahian.ocampo@udea.edu.co' })
    expect(contacts).toHaveLength(2)
    for (const contact of contacts) {
      expect(contact).toHaveAttribute('href', 'mailto:brahian.ocampo@udea.edu.co')
    }
  })

  // Historia HU506: antes de guardar el perfil, la política lo dice.
  it('dice que guarda el nombre, la institución y el tipo de usuario y que se muestran con lo que se aporta', () => {
    render(<DataPolicyPage />)

    const stored = screen.getByRole('heading', { name: 'Qué datos guardamos' }).closest('section')
    expect(stored).toHaveTextContent('Tu nombre, tu institución y si eres estudiante o docente.')
    const purpose = screen.getByRole('heading', { name: 'Para qué los usamos' }).closest('section')
    expect(purpose).toHaveTextContent('se muestran junto a lo que aportas')
    expect(purpose).toHaveTextContent('Tu correo no se muestra nunca a nadie más.')
  })

  it('tiene la nueva fecha de vigencia y dice qué cambió respecto a la anterior', () => {
    render(<DataPolicyPage />)

    expect(screen.getByText('1 de noviembre de 2026')).toHaveAttribute('datetime', '2026-11-01')
    expect(screen.getByText(/Esta versión reemplaza a la del 30 de octubre de 2026/)).toBeInTheDocument()
  })

  it('enumera los derechos del artículo 8 de la Ley 1581', () => {
    render(<DataPolicyPage />)

    const rights = screen.getByRole('heading', { name: 'Tus derechos' }).closest('section')
    expect(rights.querySelectorAll('li')).toHaveLength(6)
  })
})
