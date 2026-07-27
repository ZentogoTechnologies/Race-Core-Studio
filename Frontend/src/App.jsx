import { useState } from 'react'
import LoginScreen from './components/auth/LoginScreen'
import EventSelectionScreen from './components/events/EventSelectionScreen'
import MainLayout from './layouts/MainLayout'

// ==========================================
// 📁 src/App.jsx — Punto de entrada y Rutas
// ==========================================
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [eventType, setEventType] = useState(null) // 'drag' | 'circuito' | null

  // Flujo 1: No autenticado -> Login
  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />
  }

  // Flujo 2: Autenticado pero sin evento seleccionado -> Selección de Evento
  if (!eventType) {
    return <EventSelectionScreen onSelectEvent={(type) => setEventType(type)} />
  }

  // Flujo 3: Autenticado y con evento -> Aplicación Principal
  return (
    <MainLayout
      eventType={eventType}
      onLogout={() => {
        setIsAuthenticated(false)
        setEventType(null)
      }}
      onChangeEvent={() => setEventType(null)}
    />
  )
}
