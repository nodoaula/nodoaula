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

function optionNames() {
  return screen.queryAllByRole('option').map((option) => option.textContent)
}

describe('CoursePicker', () => {
  afterEach(cleanup)

  it('al entrar despliega los cursos y al escribir los filtra sin distinguir mayúsculas ni tildes', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Curso' }))
    expect(optionNames()).toEqual(['Cálculo Integral', 'Física de Campos', 'Física Mecánica'])

    await user.type(screen.getByRole('combobox', { name: 'Curso' }), 'fisica')
    expect(optionNames()).toEqual(['Física de Campos', 'Física Mecánica', 'Crear el curso «fisica»'])

    await user.click(screen.getByRole('option', { name: 'Física de Campos' }))
    expect(screen.getByRole('status')).toHaveTextContent('Física de Campos')
  })

  it('se elige con las flechas y Enter, y Escape cierra la lista', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Curso' })

    await user.click(input)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Física de Campos' }).id)

    await user.keyboard('{Escape}')
    expect(input).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('Cálculo Integral')
  })

  it('escribir un nombre no crea el curso: hay que elegir «Crear el curso»', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByRole('combobox', { name: 'Curso' }), '  Física   Cuántica ')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('sin curso')

    await user.click(screen.getByRole('option', { name: 'Crear el curso «Física Cuántica»' }))
    expect(screen.getByRole('status')).toHaveTextContent('Física Cuántica (nuevo)')
    expect(screen.getByText('curso nuevo')).toBeInTheDocument()
  })

  it('no ofrece crear un curso que ya existe con otras mayúsculas o tildes, y Enter lo elige', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByRole('combobox', { name: 'Curso' }), 'CALCULO INTEGRAL')
    expect(optionNames()).toEqual(['Cálculo Integral'])

    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('Cálculo Integral')
  })

  it('«Cambiar» vuelve a la búsqueda con el foco en ella', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ id: 3, name: 'Cálculo Integral', isNew: false }} />)

    await user.click(screen.getByRole('button', { name: 'Cambiar de curso' }))

    expect(screen.getByRole('combobox', { name: 'Curso' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('sin curso')
  })
})
