import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { createDocument, listCoursesWithResources, listTopicsWithResources } from './api.js'
import UploadDocumentPage from './UploadDocumentPage.jsx'

// Historia HU302: se interactúa como una persona (elegir el archivo, buscar el
// curso, pulsar) y nunca a través del estado del componente (ADR-009).
vi.mock('./api.js', () => ({
  createDocument: vi.fn(),
  listCoursesWithResources: vi.fn(),
  listTopicsWithResources: vi.fn(),
}))

let session
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))

const COURSES = [
  { id: 1, name: 'Cálculo Integral' },
  { id: 2, name: 'Física de Campos' },
]

function pdf(name = 'series-y-sucesiones.pdf', bytes = 2516582) {
  return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })
}

function renderPage(path = '/subir-apunte') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/subir-apunte" element={<UploadDocumentPage />} />
        <Route path="/iniciar-sesion" element={<p>Inicio de sesión</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function chooseFile(user, file = pdf()) {
  await user.upload(await screen.findByLabelText('Elegir archivo'), file)
}

async function fillValidForm(user) {
  await chooseFile(user)
  await user.type(await screen.findByLabelText('Curso'), 'calculo{Enter}')
  await user.click(await screen.findByRole('button', { name: 'Añadir el tema Series' }))
  await user.click(screen.getByLabelText(/Declaro que este apunte es de mi autoría/))
}

describe('UploadDocumentPage', () => {
  beforeEach(() => {
    session = { status: 'ready', account: { id: 7, email: 'aporte@ejemplo.com' } }
    listCoursesWithResources.mockResolvedValue(COURSES)
    listTopicsWithResources.mockResolvedValue([{ id: 10, name: 'Series' }, { id: 11, name: 'Sucesiones' }])
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('sin sesión no ofrece el formulario y lleva a iniciar sesión', () => {
    session = { status: 'ready', account: null }
    renderPage()

    expect(screen.getByText('Inicio de sesión')).toBeInTheDocument()
  })

  it('al elegir el PDF propone el título y pasa a los pasos', async () => {
    const user = userEvent.setup()
    renderPage()

    await chooseFile(user)

    expect(screen.getByText('series-y-sucesiones.pdf')).toBeInTheDocument()
    expect(screen.getByText('PDF · 2,4 MB')).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Series y sucesiones')
    expect(screen.getByRole('heading', { name: '¿De qué curso es?' })).toBeInTheDocument()
  })

  it.each([
    [pdf('notas.docx'), '«notas.docx» no es un PDF. Expórtalo a PDF y vuelve a elegirlo.'],
    [pdf('escaneo.pdf', 21 * 1024 * 1024), '«escaneo.pdf» pesa 21 MB y el límite es 20 MB. Comprímelo o divídelo en partes.'],
  ])('rechaza en el navegador un archivo que no sirve', async (file, message) => {
    const user = userEvent.setup({ applyAccept: false })
    renderPage()

    await chooseFile(user, Object.defineProperty(file, 'type', { value: file.name.endsWith('.docx') ? 'application/msword' : 'application/pdf' }))

    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByRole('heading', { name: '¿De qué curso es?' })).not.toBeInTheDocument()
  })

  it('desde la página de un curso llega con el curso puesto', async () => {
    const user = userEvent.setup()
    renderPage('/subir-apunte?courseId=2')

    await chooseFile(user)

    expect((await screen.findByRole('button', { name: 'Cambiar de curso' })).parentElement).toHaveTextContent('Física de Campos')
    expect(screen.getByRole('link', { name: 'Física de Campos' })).toHaveAttribute('href', '/catalogo/cursos/2')
  })

  it('no publica sin curso, sin temas ni sin la declaración, y dice qué falta', async () => {
    const user = userEvent.setup()
    renderPage()

    await chooseFile(user)
    await user.click(screen.getByRole('button', { name: 'Publicar apunte' }))

    expect(screen.getByText('Elige un curso de la lista o crea uno nuevo.')).toBeInTheDocument()
    expect(screen.getByText('Declara que el apunte es de tu autoría o que tienes permiso para compartirlo.')).toBeInTheDocument()
    expect(screen.getByText('Revisa los campos marcados.')).toBeInTheDocument()
    expect(createDocument).not.toHaveBeenCalled()
  })

  it('publica el apunte y se queda en la página para ver el apunte o subir otro', async () => {
    const user = userEvent.setup()
    createDocument.mockResolvedValue({ id: 40, title: 'Series y sucesiones', course: 'Cálculo Integral', resourceType: 'DOCUMENT' })
    renderPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Publicar apunte' }))

    expect(createDocument).toHaveBeenCalledWith({
      file: expect.any(File),
      title: 'Series y sucesiones',
      description: '',
      course: 'Cálculo Integral',
      topics: ['Series'],
      rightsDeclared: true,
    })
    const heading = await screen.findByRole('heading', { name: 'Publicaste «Series y sucesiones»' })
    expect(heading).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Ver el apunte' })).toHaveAttribute('href', '/recursos/40')

    await user.click(screen.getByRole('button', { name: 'Subir otro apunte' }))
    await chooseFile(user)
    expect(screen.getByRole('button', { name: 'Cambiar de curso' }).parentElement).toHaveTextContent('Cálculo Integral')
  })

  it('crear un curso nuevo lo envía con su nombre', async () => {
    const user = userEvent.setup()
    createDocument.mockResolvedValue({ id: 41, title: 'Series y sucesiones' })
    renderPage()

    await chooseFile(user)
    await user.type(await screen.findByLabelText('Curso'), 'Física Cuántica')
    await user.click(screen.getByRole('button', { name: 'Crear el curso «Física Cuántica»' }))
    await user.type(screen.getByLabelText('Escribe un tema'), 'Espín{Enter}')
    await user.click(screen.getByLabelText(/Declaro que este apunte es de mi autoría/))
    await user.click(screen.getByRole('button', { name: 'Publicar apunte' }))

    await waitFor(() => expect(createDocument).toHaveBeenCalled())
    expect(createDocument.mock.calls[0][0]).toMatchObject({ course: 'Física Cuántica', topics: ['Espín'] })
  })

  it('un rechazo del servidor sobre el archivo se muestra junto al archivo', async () => {
    const user = userEvent.setup()
    createDocument.mockRejectedValue(new ApiError('400', {
      status: 400,
      body: { code: 'VALIDATION_FAILED', errors: [{ field: 'file', message: 'El PDF está protegido con contraseña. Súbelo sin ella.' }] },
    }))
    renderPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Publicar apunte' }))

    expect(await screen.findByText('El PDF está protegido con contraseña. Súbelo sin ella.')).toBeInTheDocument()
  })

  it('sin espacio en el almacenamiento lo explica y no pierde lo escrito', async () => {
    const user = userEvent.setup()
    createDocument.mockRejectedValue(new ApiError('503', {
      status: 503,
      body: { code: 'DOCUMENT_STORAGE_FULL', detail: 'Por ahora no hay espacio para más apuntes. Inténtalo de nuevo más adelante.' },
    }))
    renderPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Publicar apunte' }))

    expect(await screen.findByText('Por ahora no hay espacio para más apuntes. Inténtalo de nuevo más adelante.')).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Series y sucesiones')
  })
})
