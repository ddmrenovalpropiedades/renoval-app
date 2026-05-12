import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      setError('Error al iniciar sesión. Intentá de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo / marca */}
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}>R</div>
          <h1 style={styles.brand}>Renoval</h1>
          <p style={styles.tagline}>Gestión de Propiedades</p>
        </div>

        <div style={styles.divider} />

        <p style={styles.instruction}>
          Iniciá sesión con tu cuenta corporativa de Google para continuar.
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ ...styles.googleBtn, ...(loading ? styles.googleBtnDisabled : {}) }}
        >
          {!loading && (
            <svg width="20" height="20" viewBox="0 0 48 48" style={{ marginRight: 10 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          )}
          {loading ? 'Redirigiendo...' : 'Continuar con Google'}
        </button>

        <p style={styles.footer}>
          Solo cuentas <strong>@renovalpropiedades.com</strong>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f8f9fa 0%, #e8edf5 100%)',
    fontFamily: "'Google Sans', 'Segoe UI', sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: 'linear-gradient(135deg, #1a73e8, #0d47a1)',
    color: '#fff',
    fontSize: 28,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    boxShadow: '0 4px 12px rgba(26,115,232,0.3)',
  },
  brand: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: '#202124',
    letterSpacing: '-0.5px',
  },
  tagline: {
    margin: '4px 0 0',
    fontSize: 14,
    color: '#5f6368',
  },
  divider: {
    width: '100%',
    height: 1,
    background: '#e8eaed',
    margin: '24px 0',
  },
  instruction: {
    fontSize: 14,
    color: '#5f6368',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 1.5,
  },
  error: {
    background: '#fce8e6',
    color: '#c5221f',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 13,
    marginBottom: 16,
    width: '100%',
    textAlign: 'center',
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px 24px',
    background: '#fff',
    border: '1px solid #dadce0',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 500,
    color: '#202124',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, border-color 0.2s',
    fontFamily: "'Google Sans', 'Segoe UI', sans-serif",
  },
  googleBtnDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  footer: {
    marginTop: 20,
    fontSize: 12,
    color: '#9aa0a6',
    textAlign: 'center',
  },
};
