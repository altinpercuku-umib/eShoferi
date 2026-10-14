import { Route, Routes } from 'react-router'
import { RequireAuth } from './auth.jsx'
import Layout from './components/Layout.jsx'
import Exam from './pages/Exam.jsx'
import History from './pages/History.jsx'
import Home from './pages/Home.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import Register from './pages/Register.jsx'
import Result from './pages/Result.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="exam" element={<RequireAuth><Exam /></RequireAuth>} />
        <Route path="exams" element={<RequireAuth><History /></RequireAuth>} />
        <Route path="exams/:id" element={<RequireAuth><Result /></RequireAuth>} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
