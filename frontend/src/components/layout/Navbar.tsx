import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: '消費記錄' },
  { to: '/cards', label: '卡片設定' },
  { to: '/dashboard', label: '儀表板' },
];

export default function Navbar() {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '2rem',
      padding: '0 2rem',
      height: '56px',
      background: '#1a1a2e',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <span style={{ fontWeight: 700, fontSize: '1.2rem', marginRight: '1rem' }}>
        Cashback Count
      </span>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          style={({ isActive }) => ({
            color: isActive ? '#e94560' : '#ccc',
            textDecoration: 'none',
            fontWeight: isActive ? 600 : 400,
            borderBottom: isActive ? '2px solid #e94560' : '2px solid transparent',
            paddingBottom: '2px',
          })}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
