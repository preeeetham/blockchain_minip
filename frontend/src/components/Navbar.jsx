import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'

export default function Navbar({ addToast }) {
  const location = useLocation()
  const { connected, publicKey, walletName, setModalOpen, disconnect } = useWallet()

  const isActive = (path) => location.pathname === path ? 'active' : ''

  const handleDisconnect = async () => {
    await disconnect()
    addToast('Wallet disconnected', 'error')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <svg viewBox="0 0 32 32" fill="none">
          <rect x="1" y="1" width="30" height="30" fill="#f2ede1" stroke="#141414" strokeWidth="2" />
          <rect x="1" y="1" width="15" height="15" fill="#e0241f" stroke="#141414" strokeWidth="2" />
          <circle cx="23.5" cy="8.5" r="7.5" fill="#1a3fd6" stroke="#141414" strokeWidth="2" />
          <path d="M1 31L16 16V31H1Z" fill="#f6c018" stroke="#141414" strokeWidth="2" />
          <rect x="16" y="16" width="15" height="15" fill="#141414" />
        </svg>
        <span className="gradient-text">DataProve</span>
      </Link>

      <ul className="navbar-links">
        <li><Link to="/" className={isActive('/')}>Home</Link></li>
        <li><Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link></li>
        <li><Link to="/register" className={isActive('/register')}>Register</Link></li>
        <li><Link to="/verify" className={isActive('/verify')}>Verify</Link></li>
      </ul>

      {connected && publicKey ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="wallet-btn" style={{ cursor: 'default' }}>
            <span className="wallet-dot"></span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{walletName}</span>
            <span>{publicKey.slice(0, 4)}...{publicKey.slice(-4)}</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDisconnect}
            title="Disconnect wallet"
            style={{ padding: '8px', borderRadius: '50%' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      ) : (
        <button className="wallet-btn" onClick={() => setModalOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="20" height="14" rx="2"/>
            <path d="M2 10h20"/>
            <circle cx="18" cy="16" r="1"/>
          </svg>
          Connect Wallet
        </button>
      )}
    </nav>
  )
}
