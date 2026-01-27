export default function TabButton({ label, isActive, active, onClick, children, disabled }) {
  const isActiveState = isActive !== undefined ? isActive : active;
  
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={
        'flex-1 md:py-3 p-2 md:px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition ' +
        (disabled 
          ? 'bg-purple-900/30 text-purple-400 cursor-not-allowed' 
          : isActiveState 
            ? 'bg-white text-purple-900' 
            : 'bg-purple-800 text-white hover:bg-purple-700')
      }
    >
      {label || children}
    </button>
  );
}
