import { BrowserRouter, Route, Routes } from 'react-router'

import CompleteProfilePage from '../features/account/CompleteProfilePage.jsx'
import DataPolicyPage from '../features/account/DataPolicyPage.jsx'
import LoginPage from '../features/account/LoginPage.jsx'
import ProfilePage from '../features/account/ProfilePage.jsx'
import RegisterPage from '../features/account/RegisterPage.jsx'
import CourseIndexPage from '../features/catalog/CourseIndexPage.jsx'
import CoursePage from '../features/catalog/CoursePage.jsx'
import CreateResourcePage from '../features/catalog/CreateResourcePage.jsx'
import EditResourcePage from '../features/catalog/EditResourcePage.jsx'
import ResourceDetailPage from '../features/catalog/ResourceDetailPage.jsx'
import UploadDocumentPage from '../features/catalog/UploadDocumentPage.jsx'
import ForumPage from '../features/forum/ForumPage.jsx'
import QuestionPage from '../features/forum/QuestionPage.jsx'
import LandingPage from '../features/landing/LandingPage.jsx'
import StudyGroupsPage from '../features/studygroup/StudyGroupsPage.jsx'
import RequireCompleteProfile from '../session/RequireCompleteProfile.jsx'
import SessionProvider from '../session/SessionProvider.jsx'
import AppLayout from './AppLayout.jsx'
import NotFoundPage from './NotFoundPage.jsx'
import { SERVER_STATUS, useServerStatus } from './serverStatus.js'
import ServerWakeScreen from './ServerWakeScreen.jsx'

export default function App() {
  const [serverStatus, retryServer] = useServerStatus()

  // La sesión se consulta solo con el servidor ya despierto: antes, la
  // pregunta se perdería en la espera del arranque.
  if (serverStatus === SERVER_STATUS.READY) {
    return (
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            {/* Una cuenta anterior al perfil lo completa antes de seguir (HU506). */}
            <Route element={<RequireCompleteProfile />}>
              <Route index element={<LandingPage />} />
              <Route element={<AppLayout />}>
                <Route path="catalogo" element={<CourseIndexPage />} />
                <Route path="catalogo/cursos/:courseId" element={<CoursePage />} />
                <Route path="catalogo/cursos/:courseId/foro" element={<ForumPage />} />
                <Route path="catalogo/cursos/:courseId/grupos" element={<StudyGroupsPage />} />
                <Route path="foro/preguntas/:questionId" element={<QuestionPage />} />
                <Route path="recursos/:resourceId" element={<ResourceDetailPage />} />
                <Route path="recursos/:resourceId/corregir" element={<EditResourcePage />} />
                <Route path="subir-apunte" element={<UploadDocumentPage />} />
                <Route path="registrar-recurso" element={<CreateResourcePage />} />
                <Route path="registro" element={<RegisterPage />} />
                <Route path="iniciar-sesion" element={<LoginPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="completar-perfil" element={<CompleteProfilePage />} />
                <Route path="politica-de-datos" element={<DataPolicyPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    )
  }

  return <ServerWakeScreen status={serverStatus} onRetry={retryServer} />
}
