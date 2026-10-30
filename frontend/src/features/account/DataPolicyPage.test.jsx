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

  it('enumera los derechos del artículo 8 de la Ley 1581', () => {
    render(<DataPolicyPage />)

    const rights = screen.getByRole('heading', { name: 'Tus derechos' }).closest('section')
    expect(rights.querySelectorAll('li')).toHaveLength(6)
  })
})
