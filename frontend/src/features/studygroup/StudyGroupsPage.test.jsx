import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { listResources } from '../catalog/api.js'
import { createGroup, listGroups, retireGroup } from './api.js'
import StudyGroupsPage from './StudyGroupsPage.jsx'

let session = { status: 'ready', account: null }
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))
vi.mock('../catalog/api.js', () => ({ listResources: vi.fn() }))
vi.mock('./api.js', () => ({ listGroups: vi.fn(), createGroup: vi.fn(), retireGroup: vi.fn() }))

const RESOURCES = [{ id: 10, title: 'Spring Boot 2026-2', course: 'Arquitectura de Software' }]
const GROUP = {
  id: 4,
  courseId: 1,
  name: 'Parcial de patrones',
  description: 'Repasamos los patrones GoF antes del parcial.',
  createdAt: '2026-10-31T15:00:00Z',
  threadId: 70,
  member: false,
  canRetire: false,
}

function Destination({ name }) {
  const { state } = useLocation()
  return <p>{`${name} desde ${state?.from ?? 'ninguna'}`}</p>
}

function renderGroups(courseId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/catalogo/cursos/${courseId}/grupos`]}>
      <Routes>
        <Route path="/catalogo/cursos/:courseId/grupos" element={<StudyGroupsPage />} />
        <Route path="/iniciar-sesion" element={<Destination name="Inicio de sesión" />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function groupList() {
  return screen.findByRole('list', { name: 'Grupos del curso' })
}

describe('StudyGroupsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session = { status: 'ready', account: null }
    listResources.mockResolvedValue(RESOURCES)
    listGroups.mockResolvedValue([GROUP])
  })

  afterEach(cleanup)

  it('sin sesión muestra los grupos del curso, cada uno enlazado a su hilo, e invita a iniciar sesión', async () => {
    renderGroups()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Grupos de Arquitectura de Software')
    expect(listGroups).toHaveBeenCalledWith('1')
    const list = await groupList()
    const row = within(list).getByRole('article')
    expect(within(row).getByRole('link', { name: 'Parcial de patrones' })).toHaveAttribute('href', '/foro/preguntas/70')
    expect(within(row).getByText(GROUP.description)).toBeInTheDocument()
    expect(within(row).getByText('Grupo')).toBeInTheDocument()
    expect(within(row).queryByText('Eres miembro')).not.toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /Retirar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Arquitectura de Software' })).toHaveAttribute('href', '/catalogo/cursos/1')

    expect(screen.queryByRole('form', { name: 'Crear un grupo' })).not.toBeInTheDocument()
    expect(screen.getByText('Inicia sesión para crear un grupo')).toBeInTheDocument()
  })

  it('iniciar sesión lleva la página para volver a ella', async () => {
    renderGroups()
    await groupList()

    fireEvent.click(screen.getByRole('link', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Inicio de sesión desde /catalogo/cursos/1/grupos')).toBeInTheDocument()
  })

  it('sin grupos lo dice', async () => {
    listGroups.mockResolvedValue([])
    renderGroups()

    expect(await screen.findByText('Aún no hay grupos en este curso. Crea el primero.')).toBeInTheDocument()
  })

  it('un curso sin recursos se trata como no encontrado, y una dirección sin número no pregunta', async () => {
    listResources.mockResolvedValue([])
    renderGroups()
    expect(await screen.findByText('Curso no encontrado')).toBeInTheDocument()
    cleanup()

    renderGroups('abc')
    expect(await screen.findByText('Curso no encontrado')).toBeInTheDocument()
    expect(listGroups).toHaveBeenCalledTimes(1)
  })

  it('si falla la carga avisa con una alerta', async () => {
    listGroups.mockRejectedValue(new ApiError('x', { status: 500 }))
    renderGroups()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los grupos')
  })

  it('con sesión crea un grupo: aparece primero, como miembro, con el foco y el anuncio', async () => {
    session = { status: 'ready', account: { id: 5 } }
    const created = { ...GROUP, id: 9, name: 'Taller de Spring', description: null, threadId: 71, member: true, canRetire: true }
    createGroup.mockResolvedValue(created)
    renderGroups()
    await screen.findByRole('form', { name: 'Crear un grupo' })

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Taller de Spring ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))

    await waitFor(() =>
      expect(createGroup).toHaveBeenCalledWith({ courseId: 1, name: 'Taller de Spring', description: null }),
    )
    const rows = within(await groupList()).getAllByRole('article')
    expect(rows[0]).toHaveTextContent('Taller de Spring')
    expect(rows[0]).toHaveTextContent('Eres miembro')
    expect(rows[0]).toHaveFocus()
    expect(await screen.findByText('Creaste el grupo Taller de Spring.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('')
  })

  it('envía la descripción sin los espacios de los extremos', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createGroup.mockResolvedValue({ ...GROUP, id: 9 })
    renderGroups()
    await screen.findByRole('form', { name: 'Crear un grupo' })

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Repaso' } })
    fireEvent.change(screen.getByLabelText(/Descripción/), { target: { value: '  Los martes.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))

    await waitFor(() => expect(createGroup).toHaveBeenCalledWith(expect.objectContaining({ description: 'Los martes.' })))
  })

  it('sin nombre, o con texto de más, muestra el error junto al campo con el foco en él y no llama al backend', async () => {
    session = { status: 'ready', account: { id: 5 } }
    renderGroups()
    await screen.findByRole('form', { name: 'Crear un grupo' })

    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))
    expect(await screen.findByText('Escribe el nombre del grupo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Repaso' } })
    fireEvent.change(screen.getByLabelText(/Descripción/), { target: { value: 'd'.repeat(2001) } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))
    expect(await screen.findByText('La descripción no puede tener más de 2000 caracteres.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Descripción/)).toHaveFocus()
    expect(createGroup).not.toHaveBeenCalled()
  })

  it('un nombre repetido en el curso se señala junto al nombre y conserva lo escrito', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createGroup.mockRejectedValue(new ApiError('x', { status: 409, body: { code: 'STUDY_GROUP_NAME_TAKEN' } }))
    renderGroups()
    await screen.findByRole('form', { name: 'Crear un grupo' })

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'parcial de patrones' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))

    expect(await screen.findByText('Ya hay un grupo con ese nombre en este curso. Elige otro.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('parcial de patrones')
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
    expect(within(await groupList()).getAllByRole('article')).toHaveLength(1)
  })

  it('quien puede retirarlo lo retira tras confirmarlo: sale de la lista, el foco va a la lista y se anuncia', async () => {
    session = { status: 'ready', account: { id: 5 } }
    listGroups.mockResolvedValue([{ ...GROUP, member: true, canRetire: true }])
    retireGroup.mockResolvedValue(null)
    renderGroups()
    await groupList()

    fireEvent.click(screen.getByRole('button', { name: 'Retirar el grupo Parcial de patrones' }))
    const dialog = screen.getByRole('dialog', { name: '¿Retirar este grupo?' })
    expect(within(dialog).getByText(/su hilo dejará de verse en el foro/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, retirar' }))

    await waitFor(() => expect(retireGroup).toHaveBeenCalledWith(4))
    expect(await screen.findByText('Aún no hay grupos en este curso. Crea el primero.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Grupos' })).toHaveFocus()
    expect(await screen.findByText('Retiraste el grupo Parcial de patrones.')).toBeInTheDocument()
  })

  it('cancelar el retiro no llama al backend', async () => {
    session = { status: 'ready', account: { id: 5 } }
    listGroups.mockResolvedValue([{ ...GROUP, canRetire: true }])
    renderGroups()
    await groupList()

    fireEvent.click(screen.getByRole('button', { name: 'Retirar el grupo Parcial de patrones' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(retireGroup).not.toHaveBeenCalled()
    expect(within(await groupList()).getAllByRole('article')).toHaveLength(1)
  })

  it('si retirar falla, lo dice junto al grupo y el foco vuelve al botón', async () => {
    session = { status: 'ready', account: { id: 5 } }
    listGroups.mockResolvedValue([{ ...GROUP, canRetire: true }])
    retireGroup.mockRejectedValue(new ApiError('x', { status: 403, body: { code: 'STUDY_GROUP_CHANGE_FORBIDDEN' } }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderGroups()
    await groupList()

    fireEvent.click(screen.getByRole('button', { name: 'Retirar el grupo Parcial de patrones' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, retirar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo quien creó este grupo o una cuenta del equipo puede retirarlo.',
    )
    expect(screen.getByRole('button', { name: 'Retirar el grupo Parcial de patrones' })).toHaveFocus()
  })

  it('si otra cuenta ya lo había retirado, desaparece igual de la lista', async () => {
    session = { status: 'ready', account: { id: 5 } }
    listGroups.mockResolvedValue([{ ...GROUP, canRetire: true }])
    retireGroup.mockRejectedValue(new ApiError('x', { status: 404, body: { code: 'STUDY_GROUP_NOT_FOUND' } }))
    renderGroups()
    await groupList()

    fireEvent.click(screen.getByRole('button', { name: 'Retirar el grupo Parcial de patrones' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, retirar' }))

    expect(await screen.findByText('Aún no hay grupos en este curso. Crea el primero.')).toBeInTheDocument()
  })

  it('mientras no se sabe si hay sesión espera, sin pedir los grupos', () => {
    session = { status: 'loading', account: null }
    renderGroups()

    expect(screen.getByText('Cargando grupos…')).toBeInTheDocument()
    expect(listGroups).not.toHaveBeenCalled()
  })
})
