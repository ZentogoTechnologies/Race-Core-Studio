// ==========================================
// 📁 src/components/layout/NavItem.jsx
// ==========================================
export default function NavItem({ icon, label, isActive, onClick, isOpen }) {
  return (
    <button
      onClick={onClick}
      title={!isOpen ? label : ''}
      className={`
        w-full flex items-center py-3 rounded-lg transition-all duration-200
        ${isOpen ? 'justify-start px-4 gap-4' : 'justify-center px-0'}
        ${
          isActive
            ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
            : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
        }
      `}
    >
      <div className={isActive ? 'text-white' : ''}>{icon}</div>
      {isOpen && <span className="font-semibold whitespace-nowrap">{label}</span>}
    </button>
  )
}
