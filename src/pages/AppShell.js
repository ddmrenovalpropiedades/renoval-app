import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutGrid, CheckSquare, DollarSign, FileText,
  Zap, Users, LogOut, ChevronLeft, ChevronRight,
  Building2, MessageCircle
} from 'lucide-react';
import UserManagement from '../components/UserManagement';
import TasksPage from './TasksPage';
import PropertiesPage from './PropertiesPage';
import PizarraPage from './PizarraPage';
import ArrendadasPage from './ArrendadasPage';
import ContratosPage from './ContratosPage';
import SaldosPage from './SaldosPage';
import MensajesPage from './MensajesPage';

const NAV_ITEMS = [
  { id: 'cartera',    label: 'Cartera',                 icon: Building2,      ownerOnly: false },
  { id: 'pizarra',    label: 'Pizarra',                 icon: LayoutGrid,     ownerOnly: false },
  { id: 'arrendadas', label: 'Propiedades Arrendadas',  icon: Building2,      ownerOnly: false },
  { id: 'tareas',     label: 'Tareas Pendientes',       icon: CheckSquare,    ownerOnly: false },
  { id: 'cuentas',    label: 'Cuentas por Cobrar',      icon: DollarSign,     ownerOnly: true  },
  { id: 'servicios',  label: 'Saldos',                  icon: Zap,            ownerOnly: false },
  { id: 'mensajes',   label: 'Mensajes',                icon: MessageCircle,  ownerOnly: false },
  { id: 'contratos',  label: 'Contratos',               icon: FileText,       ownerOnly: false },
  { id: 'usuarios',   label: 'Usuarios',                icon: Users,          ownerOnly: true  },
];

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const [activeModule, setActiveModule] = useState('pizarra');
  const [collapsed, setCollapsed] = useState(false);

  const visibleNav = NAV_ITEMS.filter(item => !item.ownerOnly || profile?.isOwner);

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={{ ...styles.sidebar, width: collapsed ? 64 : 240 }}>
        {/* Header */}
        <div style={styles.sidebarHeader}>
          <div style={styles.logoMark}>R</div>
          {!collapsed && <span style={styles.brandName}>Renoval</span>}
          <button style={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={styles.nav}>
          {visibleNav.map(item => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                style={{
                  ...styles.navItem,
                  ...(active ? styles.navItemActive : {}),
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
                title={collapsed ? item.label : ''}
              >
                <Icon size={20} style={{ flexShrink: 0, color: active ? '#1a73e8' : '#5f6368' }} />
                {!collapsed && (
                  <span style={{ ...styles.navLabel, color: active ? '#1a73e8' : '#3c4043' }}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User area */}
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

      {/* Main content */}
      <main style={{
        ...styles.main,
        padding: activeModule === 'mensajes' ? 0 : 32,
        overflow: activeModule === 'mensajes' ? 'hidden' : 'auto',
      }}>
        <ModuleRenderer module={activeModule} profile={profile} />
      </main>
    </div>
  );
}

function ModuleRenderer({ module, profile }) {
  switch (module) {
    case 'pizarra':
      return <PizarraPage />;
    case 'arrendadas':
      return <ArrendadasPage />;
    case 'contratos':
      return <ContratosPage />;
    case 'cartera':
      return <PropertiesPage />;
    case 'servicios':
      return <SaldosPage />;
    case 'tareas':
      return <TasksPage />;
    case 'mensajes':
      return <MensajesPage currentUser={profile} />;
    case 'usuarios':
      return <UserManagement />;
    default:
      return <ComingSoon module={module} />;
  }
}

function ComingSoon({ module }) {
  const labels = {
    pizarra: 'Pizarra',
    arrendadas: 'Propiedades Arrendadas',
    tareas: 'Tareas Pendientes',
    cuentas: 'Cuentas por Cobrar',
    servicios: 'Servicios y Gastos',
  };
  return (
    <div style={styles.comingSoon}>
      <div style={styles.comingSoonIcon}>🚧</div>
      <h2 style={styles.comingSoonTitle}>{labels[module]}</h2>
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
  },
  sidebar: {
    background: '#fff',
    borderRight: '1px solid #e8eaed',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s ease',
    overflow: 'hidden',
    flexShrink: 0,
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 12px',
    borderBottom: '1px solid #e8eaed',
    gap: 10,
    minHeight: 60,
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'linear-gradient(135deg, #1a73e8, #0d47a1)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandName: {
    fontSize: 17,
    fontWeight: 700,
    color: '#202124',
    flex: 1,
    whiteSpace: 'nowrap',
  },
  collapseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    color: '#5f6368',
    marginLeft: 'auto',
  },
  nav: {
    flex: 1,
    padding: '8px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.15s',
    textAlign: 'left',
  },
  navItemActive: {
    background: '#e8f0fe',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 12px',
    borderTop: '1px solid #e8eaed',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  userName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#202124',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: 11,
    color: '#5f6368',
  },
  signOutBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: 32,
  },
  comingSoon: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12,
  },
  comingSoonIcon: { fontSize: 48 },
  comingSoonTitle: {
    fontSize: 22,
    fontWeight: 600,
    color: '#202124',
    margin: 0,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#5f6368',
    margin: 0,
  },
};
