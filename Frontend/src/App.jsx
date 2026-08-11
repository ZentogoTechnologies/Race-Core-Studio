import { useState } from 'react'
import LoginScreen from './components/auth/LoginScreen'
import MainLayout from './layouts/MainLayout'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />
  }

  return (
    <MainLayout onLogout={() => setIsAuthenticated(false)} />
  )
}
