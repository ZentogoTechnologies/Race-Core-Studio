import React, { useState, useMemo } from 'react';
import { 
  Menu, X, Home, Users, Car, LogOut, 
  Search, Plus, User, Droplet, Flag, Shield
} from 'lucide-react';

export default function App() {
  // Estado de Autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return <MainApp onLogout={() => setIsAuthenticated(false)} />;
}

// ==========================================
// PANTALLA DE LOGIN
// ==========================================
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    // Validación de usuario (Prototipo)
    if (username === 'admin' && password === 'admin') {
      onLogin();
    } else {
      setError('Credenciales incorrectas. Usa admin / admin');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4" style={{ backgroundImage: 'linear-gradient(45deg, #0a0a0a 25%, #1a1a1a 100%)' }}>
      <div className="bg-[#141414] border border-red-600/30 p-8 rounded-xl w-full max-w-md shadow-[0_0_50px_rgba(220,38,38,0.15)]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white italic tracking-wider">RACING<span className="text-red-600">PRO</span></h1>
          <p className="text-neutral-400 mt-2 text-sm">Sistema de Gestión de Equipos</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-neutral-400 text-xs font-bold mb-2 uppercase tracking-wider">Usuario</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-colors"
                placeholder="Ingresa tu usuario"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 text-xs font-bold mb-2 uppercase tracking-wider">Contraseña</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-colors"
                placeholder="Ingresa tu contraseña"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded">{error}</p>}

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
          >
            INGRESAR AL SISTEMA
          </button>
          
          <p className="text-center text-neutral-600 text-xs mt-4">Hint: Usa admin / admin</p>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// APLICACIÓN PRINCIPAL
// ==========================================
function MainApp({ onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeModule, setActiveModule] = useState('home');

  // Datos de prueba iniciales
  const [pilotos, setPilotos] = useState([
    { id: 1, nombre: 'Juan', apellido: 'Perez', sangre: 'O+' },
    { id: 2, nombre: 'Carlos', apellido: 'Sainz', sangre: 'A-' }
  ]);

  const vehiculos = [
    { id: 1, marca: 'Porsche', categoria: '911 GT3', equipo: 'Team Racing Panama' },
    { id: 2, marca: 'Lexus', categoria: 'RC F GT3', equipo: 'Vasser Sullivan' }
  ];

  const renderModule = () => {
    switch (activeModule) {
      case 'home':
        return <HomeModule />;
      case 'pilotos':
        return <PilotosModule pilotos={pilotos} setPilotos={setPilotos} />;
      case 'vehiculos':
        return <VehiculosModule vehiculos={vehiculos} />;
      default:
        return <HomeModule />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`bg-[#141414] border-r border-neutral-800 transition-all duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        {/* Header del Sidebar */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-800">
          {isSidebarOpen && (
            <span className="text-xl font-black italic tracking-wide text-white overflow-hidden whitespace-nowrap">
              RACING<span className="text-red-600">PRO</span>
            </span>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors mx-auto"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Menú de Navegación */}
        <nav className="flex-1 py-6 flex flex-col gap-2 px-3">
          <NavItem icon={<Home />} label="Inicio" isActive={activeModule === 'home'} onClick={() => setActiveModule('home')} isOpen={isSidebarOpen} />
          <NavItem icon={<Users />} label="Pilotos" isActive={activeModule === 'pilotos'} onClick={() => setActiveModule('pilotos')} isOpen={isSidebarOpen} />
          <NavItem icon={<Car />} label="Vehículos" isActive={activeModule === 'vehiculos'} onClick={() => setActiveModule('vehiculos')} isOpen={isSidebarOpen} />
        </nav>

        {/* Botón Logout */}
        <div className="p-4 border-t border-neutral-800">
          <button 
            onClick={onLogout}
            className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'} py-3 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors gap-3`}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-semibold">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Adorno visual superior derecho inspirado en la imagen */}
        <div className="absolute top-0 right-0 w-64 h-2 bg-red-600 rounded-bl-3xl opacity-80"></div>
        
        <header className="h-16 border-b border-neutral-800/50 flex items-center px-8">
          <h2 className="text-xl font-bold uppercase tracking-wider text-neutral-200">
            {activeModule === 'home' && 'Panel Principal'}
            {activeModule === 'pilotos' && 'Gestión de Pilotos'}
            {activeModule === 'vehiculos' && 'Directorio de Vehículos'}
          </h2>
        </header>
        
        <div className="flex-1 overflow-auto p-8">
          {renderModule()}
        </div>
      </main>
    </div>
  );
}

// Componente para items del Sidebar
function NavItem({ icon, label, isActive, onClick, isOpen }) {
  return (
    <button
      onClick={onClick}
      title={!isOpen ? label : ''}
      className={`
        w-full flex items-center py-3 rounded-lg transition-all duration-200
        ${isOpen ? 'justify-start px-4 gap-4' : 'justify-center px-0'}
        ${isActive 
          ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
          : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
        }
      `}
    >
      <div className={`${isActive ? 'text-white' : ''}`}>
        {icon}
      </div>
      {isOpen && <span className="font-semibold whitespace-nowrap">{label}</span>}
    </button>
  );
}

// ==========================================
// MÓDULOS
// ==========================================

function HomeModule() {
  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="bg-[#141414] rounded-2xl p-8 border border-neutral-800 relative overflow-hidden">
        {/* Franjas rojas decorativas */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-red-600/10 rotate-45 transform"></div>
        <div className="absolute -right-32 -top-10 w-64 h-64 bg-red-600/5 rotate-45 transform"></div>
        
        <h3 className="text-3xl font-black italic mb-2">BIENVENIDO AL SISTEMA</h3>
        <p className="text-neutral-400">Selecciona un módulo en el menú lateral para comenzar a gestionar la información del equipo.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-[#0a0a0a] p-6 rounded-xl border border-neutral-800 flex items-center gap-4">
            <div className="bg-red-600/20 p-4 rounded-full text-red-500">
              <Users size={32} />
            </div>
            <div>
              <p className="text-neutral-400 text-sm font-bold uppercase">Total Pilotos</p>
              <p className="text-3xl font-black">Activos</p>
            </div>
          </div>
          <div className="bg-[#0a0a0a] p-6 rounded-xl border border-neutral-800 flex items-center gap-4">
            <div className="bg-red-600/20 p-4 rounded-full text-red-500">
              <Car size={32} />
            </div>
            <div>
              <p className="text-neutral-400 text-sm font-bold uppercase">Vehículos</p>
              <p className="text-3xl font-black">Registrados</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PilotosModule({ pilotos, setPilotos }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  
  // Estado para nuevo piloto
  const [newPiloto, setNewPiloto] = useState({ nombre: '', apellido: '', sangre: '' });

  const filteredPilotos = useMemo(() => {
    return pilotos.filter(p => 
      p.nombre.toLowerCase().includes(search.toLowerCase()) || 
      p.apellido.toLowerCase().includes(search.toLowerCase())
    );
  }, [pilotos, search]);

  const handleAddPiloto = (e) => {
    e.preventDefault();
    if (!newPiloto.nombre || !newPiloto.apellido || !newPiloto.sangre) return;
    
    setPilotos([...pilotos, { ...newPiloto, id: Date.now() }]);
    setNewPiloto({ nombre: '', apellido: '', sangre: '' });
    setShowForm(false);
  };

  return (
    <div className="max-w-5xl space-y-6">
      
      {/* Barra superior de herramientas */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar piloto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141414] border border-neutral-800 text-white pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-red-600 transition-colors"
          />
        </div>
        
        <button 
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
          {showForm ? 'CANCELAR' : 'NUEVO PILOTO'}
        </button>
      </div>

      {/* Formulario de Agregar (Colapsable) */}
      {showForm && (
        <div className="bg-[#141414] p-6 rounded-xl border border-red-600/30 shadow-[0_0_20px_rgba(220,38,38,0.1)] mb-6 animate-fade-in">
          <h3 className="text-xl font-bold italic mb-4 flex items-center gap-2">
            <User className="text-red-600" /> REGISTRAR NUEVO PILOTO
          </h3>
          <form onSubmit={handleAddPiloto} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Nombre</label>
              <input 
                required type="text" value={newPiloto.nombre} onChange={e => setNewPiloto({...newPiloto, nombre: e.target.value})}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Apellido</label>
              <input 
                required type="text" value={newPiloto.apellido} onChange={e => setNewPiloto({...newPiloto, apellido: e.target.value})}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-neutral-400 text-xs mb-1 uppercase">Tipo de Sangre</label>
              <select 
                required value={newPiloto.sangre} onChange={e => setNewPiloto({...newPiloto, sangre: e.target.value})}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded p-2 focus:border-red-600 focus:outline-none text-white appearance-none"
              >
                <option value="">Seleccionar...</option>
                <option value="A+">A+</option><option value="A-">A-</option>
                <option value="B+">B+</option><option value="B-">B-</option>
                <option value="AB+">AB+</option><option value="AB-">AB-</option>
                <option value="O+">O+</option><option value="O-">O-</option>
              </select>
            </div>
            <div className="md:col-span-1 flex items-end">
              <button type="submit" className="w-full bg-white text-black font-bold py-2 px-4 rounded hover:bg-neutral-200 transition-colors">
                GUARDAR
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de Resultados */}
      <div className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Piloto</th>
              <th className="p-4 font-bold">Tipo de Sangre</th>
              <th className="p-4 font-bold text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredPilotos.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-8 text-center text-neutral-500">No se encontraron pilotos</td>
              </tr>
            ) : (
              filteredPilotos.map((p) => (
                <tr key={p.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-red-500 font-bold">
                        {p.nombre.charAt(0)}{p.apellido.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg">{p.nombre} <span className="uppercase">{p.apellido}</span></p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Droplet size={16} className="text-red-500" />
                      <span className="font-mono text-lg">{p.sangre}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="inline-block px-3 py-1 bg-green-500/10 text-green-500 text-xs font-bold rounded-full">
                      ACTIVO
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VehiculosModule({ vehiculos }) {
  return (
    <div className="max-w-5xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehiculos.map((v) => (
          <div key={v.id} className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden hover:border-red-600/50 transition-all duration-300 group">
            <div className="h-2 bg-neutral-800 group-hover:bg-red-600 transition-colors"></div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-1">Vehículo</p>
                  <h4 className="text-2xl font-black italic">{v.marca}</h4>
                  <p className="text-xl text-red-500 font-bold">{v.categoria}</p>
                </div>
                <div className="p-3 bg-neutral-900 rounded-lg">
                  <Car size={24} className="text-neutral-400" />
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-neutral-800">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Flag size={16} />
                  <span className="text-sm font-semibold text-white uppercase">{v.equipo}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}