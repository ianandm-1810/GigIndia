import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import AppShell from '../components/layout/AppShell.jsx'
import ProtectedRoute from '../components/common/ProtectedRoute.jsx'

const AboutPage = lazy(() => import('../pages/AboutPage.jsx'))
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage.jsx'))
const BrowseGigsPage = lazy(() => import('../pages/BrowseGigsPage.jsx'))
const ChatPage = lazy(() => import('../pages/ChatPage.jsx'))
const ClientDashboardPage = lazy(() => import('../pages/ClientDashboardPage.jsx'))
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage.jsx'))
const GigDetailPage = lazy(() => import('../pages/GigDetailPage.jsx'))
const HomePage = lazy(() => import('../pages/HomePage.jsx'))
const LoginPage = lazy(() => import('../pages/LoginPage.jsx'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'))
const PaymentsPage = lazy(() => import('../pages/PaymentsPage.jsx'))
const PostGigPage = lazy(() => import('../pages/PostGigPage.jsx'))
const PrivacyPolicyPage = lazy(() => import('../pages/PrivacyPolicyPage.jsx'))
const ProfilePage = lazy(() => import('../pages/ProfilePage.jsx'))
const RegisterPage = lazy(() => import('../pages/RegisterPage.jsx'))
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage.jsx'))
const SupportPage = lazy(() => import('../pages/SupportPage.jsx'))
const StudentDashboardPage = lazy(() => import('../pages/StudentDashboardPage.jsx'))
const StudentChatsPage = lazy(() => import('../pages/StudentChatsPage.jsx'))
const StudentProfilePage = lazy(() => import('../pages/StudentProfilePage.jsx'))
const TermsPage = lazy(() => import('../pages/TermsPage.jsx'))

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="browse-gigs" element={<BrowseGigsPage />} />
        <Route path="gigs/:gigId" element={<GigDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="*" element={<NotFoundPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="chat/:gigId" element={<ChatPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['student']} />}>
          <Route path="student" element={<StudentDashboardPage />} />
          <Route path="student-chats" element={<StudentChatsPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['client']} />}>
          <Route path="client" element={<ClientDashboardPage />} />
          <Route path="post-gig" element={<PostGigPage />} />
          <Route path="students/:username" element={<StudentProfilePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="admin" element={<AdminDashboardPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
