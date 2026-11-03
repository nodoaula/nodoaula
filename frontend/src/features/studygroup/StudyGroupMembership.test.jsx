import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { listResources } from '../catalog/api.js'
import { joinGroup, leaveGroup, listGroups, listMembers } from './api.js'
import StudyGroupsPage from './StudyGroupsPage.jsx'

let session = { status: 'ready', account: null }
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))
vi.mock('../catalog/api.js', () => ({ listResources: vi.fn() }))
vi.mock('./api.js', () => ({
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  retireGroup: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  listMembers: vi.fn(),
}))

const RESOURCES = [{ id: 10, title: 'Spring Boot 2026-2', course: 'Arquitectura de Software' }]
const GROUP = {
  id: 4,
  courseId: 1,
  name: 'Parcial de patrones',
  description: 'Repasamos los patrones GoF antes del parcial.',
  createdAt: '2026-10-31T15:00:00Z',
  threadId: 70,
  memberCount: 3,
  member: false,
  canRetire: false,
}
const MEMBER_OF = { ...GROUP, member: true }

function renderGroups() {
  return render(
    <MemoryRouter initialEntries={['/catalogo/cursos/1/grupos']}>
      <Routes>
        <Route path="/catalogo/cursos/:courseId/grupos" element={<StudyGroupsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function groupRow() {
  return within(await screen.findByRole('list', { name: 'Grupos del curso' })).getByRole('article')
}

describe('Unirse a un grupo de estudio y salir de él (HU405)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session = { status: 'ready', account: { id: 5 } }
    listResources.mockResolvedValue(RESOURCES)
    listGroups.mockResolvedValue([GROUP])
  })

  afterEach(cleanup)

  it('sin sesión se ve cuántos miembros tiene el grupo, pero no se ofrece unirse ni la lista de miembros', async () => {
    session = { status: 'ready', account: null }
    renderGroups()
    const row = await groupRow()

    expect(row).toHaveTextContent('3 miembros')
    expect(within(row).queryByRole('button', { name: /Unirse/ })).not.toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /miembros/ })).not.toBeInTheDocument()
    expect(screen.getByText('Inicia sesión para crear un grupo o unirte a uno')).toBeInTheDocument()
  })

  it('un grupo sin miembros lo dice y cualquiera con sesión puede unirse', async () => {
    listGroups.mockResolvedValue([{ ...GROUP, memberCount: 0 }])
    renderGroups()
    const row = await groupRow()

    expect(row).toHaveTextContent('Sin miembros')
    expect(within(row).getByRole('button', { name: 'Unirse al grupo Parcial de patrones' })).toBeEnabled()
  })

  it('con sesión, quien no es miembro se une: el grupo lo dice, suma un miembro, el foco va a «Salir» y se anuncia', async () => {
    joinGroup.mockResolvedValue({ ...GROUP, member: true, memberCount: 4 })
    renderGroups()
    const row = await groupRow()
    expect(within(row).queryByRole('button', { name: /los miembros/ })).not.toBeInTheDocument()

    fireEvent.click(within(row).getByRole('button', { name: 'Unirse al grupo Parcial de patrones' }))

    await waitFor(() => expect(joinGroup).toHaveBeenCalledWith(4))
    const leave = await within(row).findByRole('button', { name: 'Salir del grupo Parcial de patrones' })
    expect(leave).toHaveFocus()
    expect(row).toHaveTextContent('Eres miembro')
    expect(row).toHaveTextContent('4 miembros')
    expect(within(row).queryByRole('button', { name: /Unirse/ })).not.toBeInTheDocument()
    expect(await screen.findByText('Te uniste al grupo Parcial de patrones. Ya puedes responder en su hilo.')).toBeInTheDocument()
  })

  it('si ya era miembro, por ejemplo desde otra pestaña, lo da por hecho', async () => {
    joinGroup.mockRejectedValue(new ApiError('x', { status: 409, body: { code: 'ALREADY_A_MEMBER' } }))
    renderGroups()
    const row = await groupRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Unirse al grupo Parcial de patrones' }))

    expect(await within(row).findByText('Eres miembro')).toBeInTheDocument()
    expect(within(row).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('si unirse falla, lo dice junto al grupo y el foco vuelve al botón', async () => {
    joinGroup.mockRejectedValue(new ApiError('x', { status: 404, body: { code: 'STUDY_GROUP_NOT_FOUND' } }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderGroups()
    const row = await groupRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Unirse al grupo Parcial de patrones' }))

    expect(await within(row).findByRole('alert')).toHaveTextContent('Este grupo ya no está disponible. Recarga la página.')
    expect(within(row).getByRole('button', { name: 'Unirse al grupo Parcial de patrones' })).toHaveFocus()
  })

  it('un miembro sale tras confirmarlo: vuelve a ofrecerse unirse, con el foco, y resta un miembro', async () => {
    listGroups.mockResolvedValue([MEMBER_OF])
    leaveGroup.mockResolvedValue({ ...GROUP, member: false, memberCount: 2 })
    renderGroups()
    const row = await groupRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Salir del grupo Parcial de patrones' }))
    const dialog = screen.getByRole('dialog', { name: '¿Salir de este grupo?' })
    expect(within(dialog).getByText(/Dejarás de responder en su hilo/)).toBeInTheDocument()
    expect(within(dialog).getByText(/el grupo seguirá abierto/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, salir' }))

    await waitFor(() => expect(leaveGroup).toHaveBeenCalledWith(4))
    expect(await within(row).findByRole('button', { name: 'Unirse al grupo Parcial de patrones' })).toHaveFocus()
    expect(row).toHaveTextContent('2 miembros')
    expect(row).not.toHaveTextContent('Eres miembro')
    expect(await screen.findByText('Saliste del grupo Parcial de patrones.')).toBeInTheDocument()
  })

  it('si sale el último miembro, el grupo sigue en la lista, sin miembros, y se puede volver a unir', async () => {
    listGroups.mockResolvedValue([{ ...MEMBER_OF, memberCount: 1 }])
    leaveGroup.mockResolvedValue({ ...GROUP, member: false, memberCount: 0 })
    renderGroups()
    const row = await groupRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Salir del grupo Parcial de patrones' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, salir' }))

    expect(await within(row).findByText('Sin miembros')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Parcial de patrones' })).toHaveAttribute('href', '/foro/preguntas/70')
    expect(within(row).getByRole('button', { name: 'Unirse al grupo Parcial de patrones' })).toBeInTheDocument()
  })

  it('cancelar la salida no llama al backend', async () => {
    listGroups.mockResolvedValue([MEMBER_OF])
    renderGroups()
    const row = await groupRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Salir del grupo Parcial de patrones' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(leaveGroup).not.toHaveBeenCalled()
    expect(row).toHaveTextContent('Eres miembro')
  })

  it('un miembro despliega la lista de miembros, sin correo ni nombre, y la vuelve a ocultar', async () => {
    listGroups.mockResolvedValue([MEMBER_OF])
    listMembers.mockResolvedValue([
      { joinedAt: '2026-10-31T15:00:00Z', you: false, creator: true },
      { joinedAt: '2026-11-01T09:00:00Z', you: true, creator: false },
    ])
    renderGroups()
    const row = await groupRow()

    const toggle = within(row).getByRole('button', { name: 'Ver los miembros del grupo Parcial de patrones' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)

    const members = await within(row).findByRole('list', { name: 'Miembros del grupo' })
    expect(listMembers).toHaveBeenCalledWith(4)
    const items = within(members).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Miembro')
    expect(items[0]).toHaveTextContent('Creó el grupo')
    expect(items[1]).toHaveTextContent('Tú')
    expect(members).not.toHaveTextContent('@')
    expect(within(row).getByText(/El correo no se muestra nunca/)).toBeInTheDocument()

    const hide = within(row).getByRole('button', { name: 'Ocultar los miembros del grupo Parcial de patrones' })
    expect(hide).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(hide)
    expect(within(row).queryByRole('list', { name: 'Miembros del grupo' })).not.toBeInTheDocument()
  })

  it('si la lista de miembros no se puede cargar, lo dice', async () => {
    listGroups.mockResolvedValue([MEMBER_OF])
    listMembers.mockRejectedValue(new ApiError('x', { status: 403, body: { code: 'STUDY_GROUP_MEMBERS_ONLY' } }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderGroups()
    const row = await groupRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Ver los miembros del grupo Parcial de patrones' }))

    expect(await within(row).findByRole('alert')).toHaveTextContent('Solo los miembros del grupo ven quiénes pertenecen a él.')
  })

  it('quien sale deja de ver la lista de miembros que tenía desplegada', async () => {
    listGroups.mockResolvedValue([MEMBER_OF])
    listMembers.mockResolvedValue([{ joinedAt: '2026-11-01T09:00:00Z', you: true, creator: false }])
    leaveGroup.mockResolvedValue({ ...GROUP, member: false, memberCount: 2 })
    renderGroups()
    const row = await groupRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Ver los miembros del grupo Parcial de patrones' }))
    await within(row).findByRole('list', { name: 'Miembros del grupo' })
    fireEvent.click(within(row).getByRole('button', { name: 'Salir del grupo Parcial de patrones' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, salir' }))

    await within(row).findByRole('button', { name: 'Unirse al grupo Parcial de patrones' })
    expect(within(row).queryByRole('list', { name: 'Miembros del grupo' })).not.toBeInTheDocument()
  })
})
