import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, RequireAdmin, RequireAuth } from './AuthGate'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { ActivityDetailPage } from './pages/ActivityDetailPage'
import { AdminPage } from './pages/AdminPage'
import { PredictionsPage } from './pages/PredictionsPage'
import { CoachPage } from './pages/CoachPage'
import { DocsPage } from './pages/DocsPage'
import { ProfilePage } from './pages/ProfilePage'
import { LoginPage } from './pages/LoginPage'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="activities" element={<ActivitiesPage />} />
            <Route path="activities/:id" element={<ActivityDetailPage />} />
            <Route path="predictions" element={<PredictionsPage />} />
            <Route path="coach" element={<CoachPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route
              path="admin"
              element={
                <RequireAdmin>
                  <AdminPage />
                </RequireAdmin>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
