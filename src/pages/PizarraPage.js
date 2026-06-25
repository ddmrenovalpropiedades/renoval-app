import { useState } from 'react';
import { Home, DollarSign } from 'lucide-react';
import PizarraArriendoPage from './PizarraArriendoPage';
import PizarraVentasPage from './PizarraVentasPage';

const TABS = [
  { id: 'arriendo', label: 'Arriendo', icon: Home },
  { id: 'venta',    label: 'Venta',    icon: DollarSign },
];

export default function PizarraPage() {
  const [activeTab, setActiveTab] = useState('arriendo');

  return (
    <div style={styles.wrapper}>
      <div style={styles.tabBar}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ ...styles.tabBtn, ...(active ? styles.tabBtnActive : styles.tabBtnInactive) }}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div style={styles.content}>
        {activeTab === 'arriendo' && <PizarraArriendoPage />}
        {activeTab === 'venta'    && <PizarraVentasPage />}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Google Sans','Segoe UI',sans-serif", overflow: 'hidden' },
  tabBar: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e8eaed', flexShrink: 0 },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', border: 'none', borderBottom: '2px solid transparent', background: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', borderRadius: '8px 8px 0 0', marginBottom: -1, transition: 'all 0.15s' },
  tabBtnActive:   { color: '#1a73e8', borderBottomColor: '#1a73e8', background: '#f0f4ff' },
  tabBtnInactive: { color: '#5f6368' },
  content: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
};
