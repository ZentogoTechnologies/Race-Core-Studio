import { useState } from 'react'
import { User, Shield } from 'lucide-react'

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = (e) => {
    e.preventDefault()
    if (username === 'admin' && password === 'admin') {
      onLogin()
    } else {
      setError('Credenciales incorrectas. Usa admin / admin')
    }
  }

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4"
      style={{ backgroundImage: 'linear-gradient(45deg, #0a0a0a 25%, #1a1a1a 100%)' }}
    >
      <div className="bg-[#141414] border border-red-600/30 p-8 rounded-xl w-full max-w-md shadow-[0_0_50px_rgba(220,38,38,0.15)]">
        
        {/* Logo + Título */}
        <div className="text-center mb-8">
          <img
            src="/logo-panama.png"
            alt="Panama Logo"
            className="h-16 mx-auto mb-3 object-contain"
          />
          <h1 className="text-3xl font-black text-white italic tracking-wider">
            RACE CORE <span className="text-red-600">STUDIO</span>
          </h1>
          <p className="text-neutral-400 mt-2 text-sm">Sistema de Gestión</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-neutral-400 text-xs font-bold mb-2 uppercase tracking-wider">
              Usuario
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-red-600 transition-colors"
                placeholder="admin"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 text-xs font-bold mb-2 uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-red-600 transition-colors"
                placeholder="admin"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
          >
            INGRESAR AL SISTEMA
          </button>
        </form>
      </div>
    </div>
  )
}
