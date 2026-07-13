import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutGrid, CheckSquare, FileText,
  Zap, Users, LogOut,
  Building2, MessageCircle, CreditCard, Calculator,
  MoreHorizontal, X, MessageSquare,
} from 'lucide-react';
import { useMensajes } from '../hooks/useMensajes';
import { usePushNotifications } from '../hooks/usePushNotifications';
import UserManagement from '../components/UserManagement';
import TasksPage from './TasksPage';
import TasksPageMobile from './TasksPageMobile';
import PropertiesPage from './PropertiesPage';
import PizarraPage from './PizarraPage';
import ArrendadasPage from './ArrendadasPage';
import ContratosPage from './ContratosPage';
import SaldosPage from './SaldosPage';
import PagosPage from './PagosPage';
import MensajesPage from './MensajesPage';
import CalculadoraPage from './CalculadoraPage';
import RespuestasRapidasPage from './RespuestasRapidasPage';

// ── Nav desktop (sidebar) ─────────────────────────────────────
const NAV_ITEMS_TOP = [
  { id: 'mensajes',   label: 'Mensajes',   icon: MessageCircle, ownerOnly: false },
  { id: 'pizarra',    label: 'Pizarra',    icon: LayoutGrid,    ownerOnly: false },
  { id: 'arrendadas', label: 'Arrendadas', icon: Building2,     ownerOnly: false },
  { id: 'servicios',  label: 'Saldos',     icon: Zap,           ownerOnly: false },
  { id: 'contratos',  label: 'Documentos', icon: FileText,      ownerOnly: false },
  { id: 'tareas',     label: 'Tareas',     icon: CheckSquare,   ownerOnly: false },
];

const NAV_ITEMS_BOTTOM = [
  { id: 'pagos',       label: 'Pagos',             icon: CreditCard,    ownerOnly: true  },
  { id: 'calculadora', label: 'Calculadora',        icon: Calculator,    ownerOnly: false },
  { id: 'cartera',     label: 'Cartera',            icon: Building2,     ownerOnly: false },
  { id: 'respuestas',  label: 'Respuestas Rápidas', icon: MessageSquare, ownerOnly: true  },
  { id: 'usuarios',    label: 'Usuarios',           icon: Users,         ownerOnly: true  },
];

// ── Nav móvil ─────────────────────────────────────────────────
// Bottom nav fijo (4 ítems + Más): Mensajes, Tareas, Pizarra, Documentos
const NAV_MOBILE_BOTTOM = [
  { id: 'mensajes',  label: 'Mensajes',   icon: MessageCircle, ownerOnly: false },
  { id: 'tareas',    label: 'Tareas',     icon: CheckSquare,   ownerOnly: false },
  { id: 'pizarra',   label: 'Pizarra',    icon: LayoutGrid,    ownerOnly: false },
  { id: 'contratos', label: 'Documentos', icon: FileText,      ownerOnly: false },
];

// Menú "Más" móvil: todo lo que no está en el bottom nav
const NAV_MOBILE_MORE = [
  { id: 'arrendadas', label: 'Arrendadas',        icon: Building2,     ownerOnly: false },
  { id: 'servicios',  label: 'Saldos',            icon: Zap,           ownerOnly: false },
  { id: 'pagos',      label: 'Pagos',             icon: CreditCard,    ownerOnly: true  },
  { id: 'calculadora',label: 'Calculadora',       icon: Calculator,    ownerOnly: false },
  { id: 'cartera',    label: 'Cartera',           icon: Building2,     ownerOnly: false },
  { id: 'respuestas', label: 'Respuestas Rápidas',icon: MessageSquare, ownerOnly: true  },
  { id: 'usuarios',   label: 'Usuarios',          icon: Users,         ownerOnly: true  },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const [activeModule, setActiveModule] = useState('mensajes');
  const [hovered, setHovered]           = useState(false);
  const [moreOpen, setMoreOpen]         = useState(false);
  const isMobile                        = useIsMobile();

  const mensajesHook = useMensajes(profile);
  const { badgeCount, unlockAudio } = mensajesHook;

  usePushNotifications(profile);

  const audioUnlocked = useRef(false);
  useEffect(() => {
    const handleFirstClick = () => {
      if (audioUnlocked.current) return;
      audioUnlocked.current = true;
      unlockAudio();
      window.removeEventListener('click', handleFirstClick);
    };
    window.addEventListener('click', handleFirstClick);
    return () => window.removeEventListener('click', handleFirstClick);
  }, [unlockAudio]);

  useEffect(() => {
    const clearBadge = () => {
      if (navigator.serviceWorker?.controller)
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_BADGE' });
      if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    };
    clearBadge();
    const onVisibility = () => { if (document.visibilityState === 'visible') clearBadge(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const visibleNavTop    = NAV_ITEMS_TOP.filter(i => !i.ownerOnly || profile?.isOwner);
  const visibleNavBottom = NAV_ITEMS_BOTTOM.filter(i => !i.ownerOnly || profile?.isOwner);
  const visibleMobileBottom = NAV_MOBILE_BOTTOM.filter(i => !i.ownerOnly || profile?.isOwner);
  const visibleMobileMore   = NAV_MOBILE_MORE.filter(i => !i.ownerOnly || profile?.isOwner);

  const collapsed = !hovered;
  const fullWidth = activeModule === 'mensajes';

  const handleSelect = (id) => { setActiveModule(id); setMoreOpen(false); };

  // ── Móvil ─────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8f9fa', fontFamily: "'Google Sans','Segoe UI',sans-serif", position: 'relative' }}>

        <main style={{ flex: 1, overflow: activeModule === 'mensajes' ? 'hidden' : 'auto', paddingBottom: 64, display: 'flex', flexDirection: 'column' }}>
          <ModuleRenderer module={activeModule} profile={profile} mensajesHook={mensajesHook} isMobile={true} />
        </main>

        {/* ── Menú "Más" ── */}
        {moreOpen && (
          <>
            <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.3)' }} />
            <div style={{ position: 'fixed', bottom: 64, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e8eaed', zIndex: 160, padding: '8px 0', boxShadow: '0 -4px 16px rgba(0,0,0,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 4px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#5f6368' }}>Más opciones</span>
                <button onClick={() => setMoreOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <X size={18} color="#5f6368" />
                </button>
              </div>
              {visibleMobileMore.map(item => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button key={item.id} onClick={() => handleSelect(item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 20px', background: active ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <Icon size={20} color={active ? '#1a73e8' : '#5f6368'} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: active ? '#1a73e8' : '#3c4043' }}>{item.label}</span>
                  </button>
                );
              })}
              <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid #e8eaed', marginTop: 4 }}>
                <LogOut size={20} color="#e53935" />
                <span style={{ fontSize: 14, fontWeight: 500, color: '#e53935' }}>Cerrar sesión</span>
              </button>
            </div>
          </>
        )}

        {/* ── Bottom nav ── */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, background: '#fff', borderTop: '1px solid #e8eaed', display: 'flex', alignItems: 'stretch', zIndex: 200, boxShadow: '0 -2px 8px rgba(0,0,0,0.08)' }}>
          {visibleMobileBottom.map(item => {
            const Icon   = item.icon;
            const active = activeModule === item.id;
            const badge  = item.id === 'mensajes' ? badgeCount : 0;
            return (
              <button key={item.id} onClick={() => handleSelect(item.id)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', padding: '6px 0' }}>
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <Icon size={22} color={active ? '#1a73e8' : '#5f6368'} />
                  {badge > 0 && (
                    <span style={{ position: 'absolute', top: -5, right: -6, background: '#e53935', color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 700, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', boxSizing: 'border-box' }}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 10, color: active ? '#1a73e8' : '#5f6368', fontWeight: active ? 600 : 400 }}>{item.label}</span>
              </button>
            );
          })}
          {/* Botón Más */}
          <button onClick={() => setMoreOpen(v => !v)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', padding: '6px 0' }}>
            <MoreHorizontal size={22} color={moreOpen ? '#1a73e8' : '#5f6368'} />
            <span style={{ fontSize: 10, color: moreOpen ? '#1a73e8' : '#5f6368', fontWeight: moreOpen ? 600 : 400 }}>Más</span>
          </button>
        </nav>
      </div>
    );
  }

  // ── PC: sidebar ────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      <aside style={{ ...styles.sidebar, width: collapsed ? 64 : 240 }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logoMark}>
            <img src="/Logo_Arbol.png" alt="Renoval" style={styles.logoImg} />
          </div>
          {!collapsed && <span style={styles.brandName}>Renoval</span>}
        </div>
        <nav style={styles.nav}>
          {visibleNavTop.map(item => (
            <NavButton key={item.id} item={item} active={activeModule === item.id} collapsed={collapsed}
              badge={item.id === 'mensajes' ? badgeCount : 0} onClick={() => handleSelect(item.id)} />
          ))}
          <div style={styles.navSpacer} />
          <div style={styles.navDivider} />
          {visibleNavBottom.map(item => (
            <NavButton key={item.id} item={item} active={activeModule === item.id} collapsed={collapsed}
              badge={0} onClick={() => handleSelect(item.id)} />
          ))}
        </nav>
        <div style={styles.userArea}>
          {profile?.avatar && !collapsed && <img src={profile.avatar} alt="" style={styles.avatar} />}
          {!collapsed && (
            <div style={styles.userInfo}>
              <span style={styles.userName}>{profile?.initials}</span>
              <span style={styles.userRole}>{profile?.isOwner ? 'Propietario' : 'Colaborador'}</span>
            </div>
          )}
          <button onClick={signOut} style={styles.signOutBtn} title="Cerrar sesión">
            <LogOut size={16} color="#5f6368" />
          </button>
        </div>
      </aside>
      <main style={{ ...styles.main, paddingLeft: 64 + 32, paddingRight: 32, paddingTop: fullWidth ? 0 : 32, paddingBottom: fullWidth ? 0 : 32, overflow: fullWidth ? 'hidden' : 'auto' }}>
        <ModuleRenderer module={activeModule} profile={profile} mensajesHook={mensajesHook} isMobile={false} />
      </main>
    </div>
  );
}

function ModuleRenderer({ module, profile, mensajesHook, isMobile }) {
  switch (module) {
    case 'pizarra':      return <PizarraPage />;
    case 'arrendadas':   return <ArrendadasPage />;
    case 'contratos':    return <ContratosPage />;
    case 'cartera':      return <PropertiesPage />;
    case 'servicios':    return <SaldosPage />;
    case 'tareas':       return isMobile ? <TasksPageMobile /> : <TasksPage />;
    case 'pagos':        return <PagosPage />;
    case 'mensajes':     return <MensajesPage currentUser={profile} mensajesHook={mensajesHook} />;
    case 'usuarios':     return <UserManagement />;
    case 'calculadora':  return <CalculadoraPage />;
    case 'respuestas':   return <RespuestasRapidasPage />;
    default:             return <ComingSoon module={module} />;
  }
}

function ComingSoon({ module }) {
  const labels = { pizarra: 'Pizarra', arrendadas: 'Propiedades Arrendadas', tareas: 'Tareas Pendientes', pagos: 'Pagos', servicios: 'Saldos' };
  return (
    <div style={styles.comingSoon}>
      <div style={styles.comingSoonIcon}>🚧</div>
      <h2 style={styles.comingSoonTitle}>{labels[module] || module}</h2>
      <p style={styles.comingSoonText}>Este módulo está en construcción.</p>
    </div>
  );
}

function NavButton({ item, active, collapsed, badge, onClick }) {
  const [hov, setHov] = useState(false);
  const Icon = item.icon;
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      title={collapsed ? item.label : ''}
      style={{ ...styles.navItem, ...(active ? styles.navItemActive : hov ? styles.navItemHover : {}), justifyContent: collapsed ? 'center' : 'flex-start' }}>
      <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
        <Icon size={20} style={{ color: active ? '#1a73e8' : hov ? '#3c4043' : '#5f6368', transition: 'color 0.15s' }} />
        {badge > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -6, background: '#e53935', color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 700, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1, boxSizing: 'border-box' }}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <span style={{ ...styles.navLabel, color: active ? '#1a73e8' : hov ? '#202124' : '#3c4043', transition: 'color 0.15s' }}>{item.label}</span>
      )}
    </button>
  );
}

const styles = {
  root: { display: 'flex', height: '100vh', background: '#f8f9fa', fontFamily: "'Google Sans','Segoe UI',sans-serif", position: 'relative' },
  sidebar: { background: '#fff', borderRight: '1px solid #e8eaed', display: 'flex', flexDirection: 'column', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', flexShrink: 0, position: 'absolute', top: 0, left: 0, height: '100vh', zIndex: 100, boxShadow: '2px 0 8px rgba(0,0,0,0.08)' },
  sidebarHeader: { display: 'flex', alignItems: 'center', padding: '16px 12px', borderBottom: '1px solid #e8eaed', gap: 10, minHeight: 60 },
  logoMark: { width: 34, height: 34, borderRadius: 8, background: '#fff', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoImg: { width: 26, height: 26, objectFit: 'contain' },
  brandName: { fontSize: 17, fontWeight: 700, color: '#202124', flex: 1, whiteSpace: 'nowrap' },
  nav: { flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 },
  navSpacer: { flex: 1 },
  navDivider: { borderTop: '1px solid #e8eaed', margin: '8px 4px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', width: '100%', transition: 'background 0.15s', textAlign: 'left' },
  navItemActive: { background: '#e8f0fe' },
  navItemHover:  { background: '#f1f3f4' },
  navLabel: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' },
  userArea: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px', borderTop: '1px solid #e8eaed' },
  avatar: { width: 32, height: 32, borderRadius: '50%', flexShrink: 0 },
  userInfo: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  userName: { fontSize: 13, fontWeight: 600, color: '#202124', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { fontSize: 11, color: '#5f6368' },
  signOutBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 },
  main: { flex: 1, width: '100%', boxSizing: 'border-box' },
  comingSoon: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 },
  comingSoonIcon: { fontSize: 48 },
  comingSoonTitle: { fontSize: 22, fontWeight: 600, color: '#202124', margin: 0 },
  comingSoonText: { fontSize: 14, color: '#5f6368', margin: 0 },
};
