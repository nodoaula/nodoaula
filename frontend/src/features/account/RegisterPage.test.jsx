import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SessionProvider from '../../session/SessionProvider.jsx'
import { fetchCurrentAccount, login } from '../../session/api.js'
import { fetchInstitutions, registerAccount } from './api.js'
import RegisterPage from './RegisterPage.jsx'

// Con la sesión real: así se prueba que la cuenta iniciada al registrarse es
// la que ve el resto de la aplicación, no una simulada.
vi.mock('../../session/api.js', () => ({ fetchCurrentAccount: vi.fn(), login: vi.fn(), logout: vi.fn() }))
vi.mock('./api.js', () => ({ registerAccount: vi.fn(), fetchInstitutions: vi.fn() }))

const ACCOUNT = { id: 5, email: 'lectora@example.com', name: 'Ana Pérez', profileComplete: true }

const INSTITUTIONS = [
  { id: 11, name: 'INSTITUCION UNIVERSITARIA DIGITAL DE ANTIOQUIA -IU. DIGITAL', other: false },
  { id: 12, name: 'UNIVERSIDAD DE ANTIOQUIA', other: false },
  { id: 13, name: 'UNIVERSIDAD NACIONAL DE COLOMBIA', other: false },
  { id: 99, name: 'Otra', other: true },
]

function renderRegister(state) {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[{ pathname: '/registro', state }]}>
        <Routes>
          <Route path="registro" element={<RegisterPage />} />
          <Route path="iniciar-sesion" element={<p>Inicio de sesión</p>} />
          <Route path="catalogo" element={<p>Catálogo</p>} />
          <Route path="recursos/:resourceId" element={<p>Ficha del apunte</p>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

const AUTHORIZATION = /Tengo 18 años o más y autorizo el tratamiento de mis datos personales/

// Busca la institución y la elige de la lista, como lo haría una persona.
async function chooseInstitution(search, option) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Institución' }), { target: { value: search } })
  fireEvent.mouseDown(await screen.findByRole('option', { name: option }))
}

async function fillProfile({ name = ' Ana   Pérez ', institution = 'UNIVERSIDAD DE ANTIOQUIA', userType = 'Estudiante' } = {}) {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: name } })
  await chooseInstitution('antioquia', institution)
  fireEvent.click(screen.getByRole('radio', { name: userType }))
}

function fillAndSubmit(email, password, { authorize = true } = {}) {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
  if (authorize) fireEvent.click(screen.getByRole('checkbox', { name: AUTHORIZATION }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

describe('pantalla de registro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCurrentAccount.mockResolvedValue(null)
    fetchInstitutions.mockResolvedValue(INSTITUTIONS)
    registerAccount.mockResolvedValue(ACCOUNT)
    login.mockResolvedValue(ACCOUNT)
  })

  afterEach(() => {
    cleanup()
  })

  it('al crear la cuenta entra con la sesión iniciada y vuelve a la página de origen', async () => {
    renderRegister({ from: '/recursos/24' })

    await fillProfile()
    fillAndSubmit(' lectora@example.com ', 'contrasena-larga')

    expect(await screen.findByText('Ficha del apunte')).toBeInTheDocument()
    expect(registerAccount).toHaveBeenCalledWith({
      name: 'Ana Pérez',
      email: 'lectora@example.com',
      password: 'contrasena-larga',
      institutionId: 12,
      userType: 'STUDENT',
      dataProcessingAuthorized: true,
    })
    expect(login).toHaveBeenCalledWith({ email: 'lectora@example.com', password: 'contrasena-larga' })
  })

  it('sin la autorización no crea la cuenta y lleva el foco a la casilla', async () => {
    renderRegister()

    await fillProfile()
    fillAndSubmit('lectora@example.com', 'contrasena-larga', { authorize: false })

    const checkbox = screen.getByRole('checkbox', { name: AUTHORIZATION })
    expect(checkbox).toHaveFocus()
    expect(checkbox).toHaveAccessibleDescription(
      'Para crear la cuenta tienes que confirmar que tienes 18 años o más y autorizar el tratamiento de tus datos.',
    )
    expect(registerAccount).not.toHaveBeenCalled()

    fireEvent.click(checkbox)
    expect(checkbox).not.toHaveAccessibleDescription()
  })

  it('la política se abre en otra pestaña sin perder lo escrito', () => {
    renderRegister()

    const policy = screen.getByRole('link', { name: 'política (se abre en otra pestaña)' })
    expect(policy).toHaveAttribute('href', '/politica-de-datos')
    expect(policy).toHaveAttribute('target', '_blank')
  })

  it('sin página de origen, al crear la cuenta lleva al catálogo', async () => {
    renderRegister()

    await fillProfile()
    fillAndSubmit('lectora@example.com', 'contrasena-larga')

    expect(await screen.findByText('Catálogo')).toBeInTheDocument()
  })

  it('si no se crea la cuenta no intenta iniciar sesión y lo explica', async () => {
    registerAccount.mockRejectedValue({ status: null, timedOut: true })
    renderRegister()

    await fillProfile()
    fillAndSubmit('lectora@example.com', 'contrasena-larga')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se completó el registro')
    expect(alert).toHaveTextContent('no sabemos si la cuenta se creó')
    expect(login).not.toHaveBeenCalled()
  })

  it('al reenviar, el aviso de correo en uso de la respuesta anterior desaparece', async () => {
    registerAccount.mockRejectedValueOnce({ code: 'EMAIL_ALREADY_IN_USE', status: 409 })
    renderRegister()

    await fillProfile()
    fillAndSubmit('lectora@example.com', 'contrasena-larga')
    expect(await screen.findByText('Ya existe una cuenta con este correo.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'otra-contrasena' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.queryByText('Ya existe una cuenta con este correo.')).not.toBeInTheDocument()
    expect(await screen.findByText('Catálogo')).toBeInTheDocument()
  })

  it('un envío con errores lleva el foco al primer campo con error', async () => {
    renderRegister()

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByLabelText('Nombre')).toHaveFocus()

    await fillProfile()
    fillAndSubmit('lectora@example.com', 'corta')
    expect(screen.getByLabelText('Contraseña')).toHaveFocus()
    expect(registerAccount).not.toHaveBeenCalled()
  })

  // Historia HU506: el registro pide nombre, institución y tipo de usuario.
  it('sin nombre, institución ni tipo de usuario no crea la cuenta y lo dice en cada campo', () => {
    renderRegister()

    fillAndSubmit('lectora@example.com', 'contrasena-larga')

    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription(/Escribe tu nombre./)
    expect(screen.getByRole('combobox', { name: 'Institución' })).toHaveAccessibleDescription(
      /Elige tu institución de la lista./,
    )
    expect(screen.getByText('Elige si eres estudiante o docente.')).toBeInTheDocument()
    expect(registerAccount).not.toHaveBeenCalled()
  })

  it('el tipo de usuario es «Estudiante» o «Docente»', async () => {
    renderRegister()

    const group = screen.getByRole('group', { name: 'Soy' })
    expect(within(group).getAllByRole('radio').map((radio) => radio.labels[0].textContent)).toEqual([
      'Estudiante',
      'Docente',
    ])

    await fillProfile({ userType: 'Docente' })
    fillAndSubmit('lectora@example.com', 'contrasena-larga')

    await screen.findByText('Catálogo')
    expect(registerAccount).toHaveBeenCalledWith(expect.objectContaining({ userType: 'TEACHER' }))
  })

  it('la institución se elige de la lista: lo escrito no vale, y «Otra» siempre está', async () => {
    renderRegister()

    const search = screen.getByRole('combobox', { name: 'Institución' })
    fireEvent.change(search, { target: { value: 'UdeA' } })
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Otra'])

    fillAndSubmit('lectora@example.com', 'contrasena-larga')
    expect(search).toHaveAccessibleDescription(/Elige tu institución de la lista./)
    expect(registerAccount).not.toHaveBeenCalled()

    fireEvent.change(search, { target: { value: 'UdeA' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Otra' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Estudiante' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await screen.findByText('Catálogo')
    expect(registerAccount).toHaveBeenCalledWith(expect.objectContaining({ institutionId: 99 }))
  })

  it('el error de un campo del perfil que da el backend se señala junto al campo', async () => {
    registerAccount.mockRejectedValue({
      code: 'VALIDATION_FAILED',
      status: 400,
      body: { errors: [{ field: 'name', message: 'El nombre no puede tener más de 100 caracteres.' }] },
    })
    renderRegister()

    await fillProfile()
    fillAndSubmit('lectora@example.com', 'contrasena-larga')

    expect(await screen.findByText('El nombre no puede tener más de 100 caracteres.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
  })

  it('«Mostrar» enseña la contraseña y «Ocultar» la vuelve a tapar', () => {
    renderRegister()
    const field = screen.getByLabelText('Contraseña')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(field).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(field).toHaveAttribute('type', 'password')
  })
})
