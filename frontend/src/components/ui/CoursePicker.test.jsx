import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import CoursePicker from './CoursePicker.jsx'

const COURSES = [
  { id: 1, name: 'Física Mecánica' },
  { id: 2, name: 'Física de Campos' },
  { id: 3, name: 'Cálculo Integral' },
]

function Harness({ initial = null }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <CoursePicker id="curso" label="Curso" courses={COURSES} value={value} onChange={setValue} />
      <output>{value ? `${value.name}${value.isNew ? ' (nuevo)' : ''}` : 'sin curso'}</output>
    </>
  )
}

describe('CoursePicker', () => {
  afterEach(cleanup)

  it('filtra los cursos sin distinguir mayúsculas ni tildes y elige uno', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Curso'), 'fisica')

    expect(screen.getByRole('button', { name: 'Física de Campos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Física Mecánica' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cálculo Integral' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Física de Campos' }))
    expect(screen.getByRole('status')).toHaveTextContent('Física de Campos')
  })

  it('escribir un nombre no crea el curso: hay que pulsar «Crear el curso»', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Curso'), '  Física   Cuántica ')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('sin curso')

    await user.click(screen.getByRole('button', { name: 'Crear el curso «Física Cuántica»' }))
    expect(screen.getByRole('status')).toHaveTextContent('Física Cuántica (nuevo)')
    expect(screen.getByText('curso nuevo')).toBeInTheDocument()
  })

  it('no ofrece crear un curso que ya existe con otras mayúsculas o tildes, y Enter lo elige', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Curso'), 'CALCULO INTEGRAL')
    expect(screen.queryByRole('button', { name: /Crear el curso/ })).not.toBeInTheDocument()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('Cálculo Integral')
  })

  it('«Cambiar» vuelve a la búsqueda con el foco en ella', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ name: 'Cálculo Integral', isNew: false }} />)

    await user.click(screen.getByRole('button', { name: 'Cambiar de curso' }))

    expect(screen.getByLabelText('Curso')).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('sin curso')
  })
})
