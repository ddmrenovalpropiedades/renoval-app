import { useState } from 'react';
import { FileText, Shield, FlaskConical } from 'lucide-react';
import ContratoGeneratorPage from './ContratoGeneratorPage';
import GarantiaPage from './GarantiaPage';
import ContratosV2Page from './ContratosV2Page';
import useEsAdminDocs from '../lib/plantillas/useEsAdminDocs';

const TABS = [
  { id: 'contratos', label: 'Contratos de arriendo',   icon: FileText },
  { id: 'garantia',  label: 'Liquidación de garantía', icon: Shield },
  { id: 'v2',        label: 'Contratos v2 (beta)',     icon: FlaskConical, soloAdmin: true },
];

export default function ContratosPage() {
  const [activeTab, setActiveTab] = useState('contratos');
  const esAdmin = useEsAdminDocs();
  const tabs = TABS.filter(tab => !tab.soloAdmin || esAdmin);

  return (
    <div style={styles.wrapper}>
      {/* Tab bar */}
      <div style={styles.tabBar}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.tabBtn,
                ...(active ? styles.tabBtnActive : styles.tabBtnInactive),
              }}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'contratos' && <ContratoGeneratorPage />}
        {activeTab === 'garantia'  && <GarantiaPage />}
        {activeTab === 'v2' && esAdmin && <ContratosV2Page />}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Google Sans','Segoe UI',sans-serif",
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    marginBottom: 20,
    borderBottom: '1px solid #e8eaed',
    flexShrink: 0,
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 16px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'none',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    borderRadius: '8px 8px 0 0',
    marginBottom: -1,
    transition: 'all 0.15s',
  },
  tabBtnActive: {
    color: '#1a73e8',
    borderBottomColor: '#1a73e8',
    background: '#f0f4ff',
  },
  tabBtnInactive: {
    color: '#5f6368',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};
