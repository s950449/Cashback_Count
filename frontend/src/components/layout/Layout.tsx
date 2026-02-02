import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Navbar />
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <Outlet />
      </main>
    </div>
  );
}
