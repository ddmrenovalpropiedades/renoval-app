import React, { useState } from 'react';

const formatCLP = (val) => {
  if (val === '' || val === null || val === undefined || isNaN(val)) return '';
  return Math.round(val).toLocaleString('es-CL');
};

const diasEnMes = (isoDate) => {
  if (!isoDate) return null;
  const [y, m] = isoDate.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

const diaDelMes = (isoDate) => {
  if (!isoDate) return null;
  return parseInt(isoDate.split('-')[2], 10);
};

// Convierte texto dd/mm/yyyy a ISO yyyy-mm-dd (para cálculos internos)
const parseISO = (ddmmyyyy) => {
  if (!ddmmyyyy || ddmmyyyy.length < 10) return '';
  const [d, m, y] = ddmmyyyy.split('/');
  if (!d || !m || !y || y.length < 4) return '';
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
};

// Formatea ISO a dd/mm/yyyy para mostrar
const formatDDMMYYYY = (iso) => {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL');
};

export default function CalculadoraPage() {
  const [arriendoInput, setArriendoInput] = useState('');
  const [fechaInput, setFechaInput] = useState('');       // texto dd/mm/yyyy
  const [fechaISO, setFechaISO] = useState('');           // yyyy-mm-dd para cálculos
  const [garantiaOpc, setGarantiaOpc] = useState('');
  const [garantiaOtro, setGarantiaOtroInput] = useState('');
