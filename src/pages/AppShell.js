import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutGrid, CheckSquare, FileText,
  Zap, Users, LogOut,
  Building2, MessageCircle, CreditCard, Calculator
} from 'lucide-react';
import UserManagement from '../components/UserManagement';
import TasksPage from './TasksPage';
import PropertiesPage from './PropertiesPage';
import PizarraPage from './PizarraPage';
import ArrendadasPage from './ArrendadasPage';
import ContratosPage from './ContratosPage';
import SaldosPage from './SaldosPage';
import PagosPage from './PagosPage';
import MensajesPage from './MensajesPage';
import CalculadoraPage from './CalculadoraPage';

const NAV_ITEMS_TOP = [
  { id: 'mensajes',   label: 'Mensajes',               icon: MessageCircle, ownerOnly: false },
  { id: 'pizarra',    label: 'Pizarra',                icon: LayoutGrid,    ownerOnly: false },
  { id: 'arrendadas', label: 'Propiedades Arrendadas', icon: Building2,     ownerOnly: false },
  { id: 'servicios',  label: 'Saldos',                 icon: Zap,           ownerOnly: false },
  { id: 'contratos',  label: 'Documentos',             icon: FileText,      ownerOnly: false },
  { id: 'tareas',     label: 'Tareas Pendientes',      icon: CheckSquare,   ownerOnly: false },
];

const NAV_ITEMS_BOTTOM = [
  { id: 'pagos',       label: 'Pagos',        icon: CreditCard,  ownerOnly: true  },
  { id: 'calculadora', label: 'Calculadora',  icon: Calculator,  ownerOnly: false },
  { id: 'cartera',     label: 'Cartera',      icon: Building2,   ownerOnly: false },
  { id: 'usuarios',    label: 'Usuarios',     icon: Users,       ownerOnly: true  },
];

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const [activeModule, setActiveModule] = useState('pizarra');
  const [hovered, setHovered] = useState(false);

  const visibleNavTop    = NAV_ITEMS_TOP.filter(item => !item.ownerOnly || profile?.isOwner);
  const visibleNavBottom = NAV_ITEMS_BOTTOM.filter(item => !item.ownerOnly || profile?.isOwner);

  const collapsed = !hovered;
  const fullWidth = activeModule === 'mensajes';

  return (
    <div style={styles.root}>
      {/* Sidebar — position absolute para superponerse al contenido */}
      <aside
        style={{
          ...styles.sidebar,
          width: collapsed ? 64 : 240,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={styles.sidebarHeader}>
          <div style={styles.logoMark}>R</div>
          {!collapsed && <span style={styles.brandName}>Renoval</span>}
        </div>

        <nav style={styles.nav}>
          {visibleNavTop.map(item => (
            <NavButton
              key={item.id}
              item={item}
              active={activeModule === item.id}
              collapsed={collapsed}
              onClick={() => setActiveModule(item.id)}
            />
          ))}
          <div style={styles.navSpacer} />
          <div style={styles.navDivider} />
          {visibleNavBottom.map(item => (
            <NavButton
              key={item.id}
              item={item}
              active={activeModule === item.id}
              collapsed={collapsed}
              onClick={() => setActiveModule(item.id)}
            />
          ))}
        </nav>

        <div style={styles.userArea}>
          {profile?.avatar && !collapsed && (
            <img src={profile.avatar} alt="" style={styles.avatar} />
          )}
          {!collapsed && (
            <div style={styles.userInfo}>
              <span style={styles.userName}>{profile?.initials}</span>
              <span style={styles.userRole}>
                {profile?.isOwner ? 'Propietario' : 'Colaborador'}
              </span>
            </div>
          )}
          <button onClick={signOut} style={styles.signOutBtn} title="Cerrar sesión">
            <LogOut size={16} color="#5f6368" />
          </button>
        </div>
      </aside>

      {/* Main content — ancho fijo, sidebar se superpone encima */}
      <main style={{
        ...styles.main,
        paddingLeft: 64 + 32,
        paddingRight: 32,
        paddingTop: fullWidth ? 0 : 32,
        paddingBottom: fullWidth ? 0 : 32,
        overflow: fullWidth ? 'hidden' : 'auto',
      }}>
        <ModuleRenderer module={activeModule} profile={profile} />
      </main>
    </div>
  );
}

function ModuleRenderer({ module, profile }) {
  switch (module) {
    case 'pizarra':      return <PizarraPage />;
    case 'arrendadas':   return <ArrendadasPage />;
    case 'contratos':    return <ContratosPage />;
    case 'cartera':      return <PropertiesPage />;
    case 'servicios':    return <SaldosPage />;
    case 'tareas':       return <TasksPage />;
    case 'pagos':        return <PagosPage />;
    case 'mensajes':     return <MensajesPage currentUser={profile} />;
    case 'usuarios':     return <UserManagement />;
    case 'calculadora':  return <CalculadoraPage />;
    default:             return <ComingSoon module={module} />;
  }
}

function ComingSoon({ module }) {
  const labels = {
    pizarra: 'Pizarra', arrendadas: 'Propiedades Arrendadas',
    tareas: 'Tareas Pendientes', pagos: 'Pagos', servicios: 'Saldos',
  };
  return (
    <div style={styles.comingSoon}>
      <div style={styles.comingSoonIcon}>🚧</div>
      <h2 style={styles.comingSoonTitle}>{labels[module] || module}</h2>
      <p style={styles.comingSoonText}>Este módulo está en construcción.</p>
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    height: '100vh',
    background: '#f8f9fa',
    fontFamily: "'Google Sans', 'Segoe UI', sans-serif",
    position: 'relative',
  },
  sidebar: {
    background: '#fff',
    borderRight: '1px solid #e8eaed',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
    flexShrink: 0,
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100vh',
    zIndex: 100,
    boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
  },
  sidebarHeader: {
    display: 'flex', alignItems: 'center',
    padding: '16px 12px', borderBottom: '1px solid #e8eaed',
    gap: 10, minHeight: 60,
  },
  logoMark: {
    width: 32, height: 32, borderRadius: 8,
    background: 'linear-gradient(135deg, #1a73e8, #0d47a1)',
    color: '#fff', fontSize: 16, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  brandName: { fontSize: 17, fontWeight: 700, color: '#202124', flex: 1, whiteSpace: 'nowrap' },
  nav: { flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 },
  navSpacer: { flex: 1 },
  navDivider: { borderTop: '1px solid #e8eaed', margin: '8px 4px' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px', borderRadius: 8, border: 'none',
    background: 'none', cursor: 'pointer', width: '100%',
    transition: 'background 0.15s', textAlign: 'left',
  },
  navItemActive: { background: '#e8f0fe' },
  navItemHover:  { background: '#f1f3f4' },
  navLabel: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' },
  userArea: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 12px', borderTop: '1px solid #e8eaed',
  },
  avatar: { width: 32, height: 32, borderRadius: '50%', flexShrink: 0 },
  userInfo: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  userName: { fontSize: 13, fontWeight: 600, color: '#202124', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { fontSize: 11, color: '#5f6368' },
  signOutBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 },
  main: {
    flex: 1,
    width: '100%',
    boxSizing: 'border-box',
  },
  comingSoon: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 },
  comingSoonIcon: { fontSize: 48 },
  comingSoonTitle: { fontSize: 22, fontWeight: 600, color: '#202124', margin: 0 },
  comingSoonText: { fontSize: 14, color: '#5f6368', margin: 0 },
};

function NavButton({ item, active, collapsed, onClick }) {
  const [hov, setHov] = useState(false);
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={collapsed ? item.label : ''}
      style={{
        ...styles.navItem,
        ...(active ? styles.navItemActive : hov ? styles.navItemHover : {}),
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
    >
      <Icon size={20} style={{ flexShrink: 0, color: active ? '#1a73e8' : hov ? '#3c4043' : '#5f6368', transition: 'color 0.15s' }} />
      {!collapsed && (
        <span style={{ ...styles.navLabel, color: active ? '#1a73e8' : hov ? '#202124' : '#3c4043', transition: 'color 0.15s' }}>
          {item.label}
        </span>
      )}
    </button>
  );
}
