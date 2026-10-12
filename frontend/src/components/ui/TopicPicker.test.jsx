import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import TopicPicker from './TopicPicker.jsx'

const SUGGESTIONS = ['Electroestática', 'Gravitación', 'Capacitores']

function Harness({ initial = [] }) {
  const [value, setValue] = useState(initial)
  return <TopicPicker id="temas" label="Temas" suggestions={SUGGESTIONS} value={value} onChange={setValue} />
}

function chosen() {
  const list = screen.queryByRole('list', { name: 'Temas elegidos' })
  return list === null ? [] : within(list).getAllByRole('listitem').map((item) => item.textContent)
}

function optionNames() {
  return screen.queryAllByRole('option').map((option) => option.textContent)
}

describe('TopicPicker', () => {
  afterEach(cleanup)

  it('al entrar despliega los temas del curso; uno elegido deja de ofrecerse', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Escribe un tema' }))
    expect(optionNames()).toEqual(SUGGESTIONS)

    await user.click(screen.getByRole('option', { name: 'Gravitación' }))

    expect(chosen()).toEqual(['Gravitación'])
    expect(optionNames()).toEqual(['Electroestática', 'Capacitores'])
  })

  it('añade de uno en uno y reutiliza el existente aunque cambien mayúsculas o tildes', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Escribe un tema' })

    await user.type(input, 'Circuito  RC{Enter}')
    await user.type(input, 'ELECTROESTATICA{Enter}')

    expect(chosen()).toEqual(['Circuito RC', 'Electroestática'])
    expect(input).toHaveValue('')
  })

  it('una coma no separa temas: forma parte del nombre del tema que se añade', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByRole('combobox', { name: 'Escribe un tema' }), 'Ley de Ohm, grav{Enter}')

    expect(chosen()).toEqual(['Ley de Ohm, grav'])
  })

  it('un tema nuevo se ofrece como «Añadir el tema» y no repite uno ya elegido', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['Capacitores']} />)
    const input = screen.getByRole('combobox', { name: 'Escribe un tema' })

    await user.type(input, 'Ley de Ohm')
    await user.click(screen.getByRole('option', { name: 'Añadir el tema «Ley de Ohm»' }))
    await user.type(input, 'capacitores')
    expect(optionNames()).toEqual([])
    await user.keyboard('{Enter}')

    expect(chosen()).toEqual(['Capacitores', 'Ley de Ohm'])
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

    await user.type(screen.getByRole('combobox', { name: 'Escribe un tema' }), 'grav')
    expect(optionNames()).toEqual(['Gravitación', 'Añadir el tema «grav»'])

    await user.keyboard('{ArrowDown}{Enter}')
    expect(chosen()).toEqual(['Gravitación'])
  })
})
