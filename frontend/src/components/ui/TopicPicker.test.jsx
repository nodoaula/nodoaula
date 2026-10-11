import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import TopicPicker from './TopicPicker.jsx'

const SUGGESTIONS = ['Electroestática', 'Gravitación', 'Capacitores']

function Harness({ initial = [] }) {
  const [value, setValue] = useState(initial)
  return (
    <TopicPicker id="temas" label="Temas" courseName="Física de Campos" suggestions={SUGGESTIONS} value={value} onChange={setValue} />
  )
}

function chosen() {
  const list = screen.queryByRole('list', { name: 'Temas elegidos' })
  return list === null ? [] : within(list).getAllByRole('listitem').map((item) => item.textContent)
}

describe('TopicPicker', () => {
  afterEach(cleanup)

  it('añade un tema del curso con un clic y deja de ofrecerlo', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Añadir el tema Gravitación' }))

    expect(chosen()).toEqual(['Gravitación'])
    expect(screen.queryByRole('button', { name: 'Añadir el tema Gravitación' })).not.toBeInTheDocument()
  })

  it('añade varios escritos con comas y reutiliza el existente aunque cambien mayúsculas o tildes', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Escribe un tema'), 'Circuito  RC, capacitores ,,ELECTROESTATICA{Enter}')

    expect(chosen()).toEqual(['Circuito RC', 'Capacitores', 'Electroestática'])
    expect(screen.getByLabelText('Escribe un tema')).toHaveValue('')
  })

  it('no repite un tema ya elegido', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['Capacitores']} />)

    await user.type(screen.getByLabelText('Escribe un tema'), 'capacitores')
    await user.click(screen.getByRole('button', { name: 'Añadir' }))

    expect(chosen()).toEqual(['Capacitores'])
  })

  it('la × quita cualquier tema elegido, también uno mal escrito', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['Capacitores', 'Cirucito LC']} />)

    await user.click(screen.getByRole('button', { name: 'Quitar el tema Cirucito LC' }))

    expect(chosen()).toEqual(['Capacitores'])
  })

  it('mientras se escribe, ofrece solo los temas del curso que coinciden', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Escribe un tema'), 'grav')

    expect(screen.getByText('Coinciden en Física de Campos:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir el tema Gravitación' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir el tema Capacitores' })).not.toBeInTheDocument()
  })
})
