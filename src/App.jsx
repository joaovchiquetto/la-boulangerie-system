import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { 
  Users, Calendar, DollarSign, LayoutDashboard, 
  LogOut, Plus, Trash2, Edit2, CheckCircle, Package,
  XCircle, AlertTriangle, Menu, Cake, Download, FileText,
  Lock, Save, Search, Filter, Printer, ShoppingBag, RotateCcw, Truck, Tag, Percent,
  PieChart, TrendingUp, ArrowUpRight, ArrowDownRight, CreditCard, X, Wallet, AlertCircle, CalendarPlus
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, 
  onAuthStateChanged, signOut, updateProfile 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, getDocs, getDoc, 
  setDoc, addDoc, updateDoc, deleteDoc, query, 
  onSnapshot, serverTimestamp, where
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const EVENT_TYPES = [
  "Casamento", 
  "Aniversário", 
  "Primeira Eucaristia/Crisma", 
  "Natal", 
  "Páscoa", 
  "Confraternização", 
  "Batizado",
  "Eventos em Geral"
];

// --- CONFIGURAÇÃO FIREBASE (CORRIGIDO PARA USO REAL) ---
// ⚠️ SUBSTITUI OS VALORES ABAIXO PELOS QUE COPIASTE DO FIREBASE CONSOLE ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyAUXRnQDp9bxf52r_hVSSFfY3fvhzuzMRo",
  authDomain: "sistema-padaria-7db76.firebaseapp.com",
  projectId: "sistema-padaria-7db76",
  storageBucket: "sistema-padaria-7db76.firebasestorage.app",
  messagingSenderId: "524594677654",
  appId: "1:524594677654:web:ea059873b4c58b05897fb7"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Definimos um ID fixo ou aleatório para evitar erros de variáveis indefinidas
const appId = 'padaria-principal'; 

// Coleções (Helper para garantir caminhos corretos)
const getColRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);

// --- CONTEXTO DE AUTENTICAÇÃO E PERMISSÕES ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // Removemos a verificação de token customizado global para simplificar o deploy local
      await signInAnonymously(auth);
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(getColRef('users'), currentUser.uid);
        const snapshot = await getDoc(userDocRef);
        
        if (snapshot.exists()) {
          setUserProfile(snapshot.data());
        } else {
          setUserProfile(null); 
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasRole = (requiredRoles) => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin') return true;
    return requiredRoles.includes(userProfile.role);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, hasRole, setUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- HELPER MASK CPF/CNPJ ---
const maskCpfCnpj = (value) => {
  let v = value.replace(/\D/g, "");
  if (v.length > 14) v = v.slice(0, 14);
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
  }
  return v;
};

// --- COMPONENTES DE UI REUTILIZÁVEIS ---
const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-lg",
    secondary: "bg-stone-200 hover:bg-stone-300 text-stone-800",
    danger: "bg-red-100 text-red-700 hover:bg-red-200 border border-red-200",
    outline: "border-2 border-amber-600 text-amber-700 hover:bg-amber-50",
    ghost: "text-stone-500 hover:text-amber-600 hover:bg-amber-50"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-stone-100 p-6 ${className}`}>
    {children}
  </div>
);

const Input = ({ label, className = '', ...props }) => (
  <div className="mb-4 w-full">
    <label className="block text-stone-600 text-sm font-semibold mb-1">{label}</label>
    <input 
      {...props}
      className={`w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all ${className}`}
    />
  </div>
);

const Badge = ({ status }) => {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    admin: "bg-purple-100 text-purple-800",
    manager: "bg-blue-100 text-blue-800",
    operator: "bg-gray-100 text-gray-800"
  };
  const labels = {
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Reprovado",
    admin: "Admin",
    manager: "Gerente",
    operator: "Operador"
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${styles[status] || styles.operator}`}>
      {labels[status] || status}
    </span>
  );
};

// --- FEATURES ESPECÍFICAS ---

// 1. LOGIN (COM LIMPEZA AUTOMÁTICA DE ADMINS DUPLICADOS)
const LoginScreen = () => {
  const { user, setUserProfile } = useContext(AuthContext);
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);

    try {
        // --- LÓGICA DE SEGURANÇA DO ADMIN PRINCIPAL (PRIORIDADE) ---
        if ((loginInput === 'admin' || loginInput === 'admin') && password === '&mpresa00') {
            
            // 1. Antes de criar o novo, vamos procurar os Admins antigos/duplicados
            const q = query(getColRef('users'), where('username', '==', 'admin'));
            const snapshot = await getDocs(q);

            // 2. Deletar todos os perfis de 'admin' antigos para não duplicar na lista
            // Isso limpa os logins feitos em outros dispositivos ou sessões expiradas
            const deletePromises = snapshot.docs.map(docSnapshot => 
                deleteDoc(doc(getColRef('users'), docSnapshot.id))
            );
            await Promise.all(deletePromises);

            // 3. Criar o Admin para a sessão ATUAL
            const adminData = {
              uid: user.uid,
              email: 'admin',
              username: 'admin',
              name: 'Administrador Principal',
              role: 'admin',
              password: '&mpresa00',
              createdAt: serverTimestamp()
            };
            
            await setDoc(doc(getColRef('users'), user.uid), adminData);
            setUserProfile(adminData);
            return; 
        }

        // --- LÓGICA PARA OUTROS USUÁRIOS ---
        const q = query(getColRef('users'));
        const snapshot = await getDocs(q);
        const usersList = snapshot.docs.map(d => d.data());
        
        const foundUser = usersList.find(u => u.username === loginInput || u.email === loginInput);

        if (foundUser) {
            if (foundUser.password === password) {
                setUserProfile(foundUser);
            } else {
                alert("Senha incorreta.");
            }
        } else {
            alert("Usuário não encontrado.");
        }
    } catch (error) {
        console.error("Erro no login:", error);
        alert("Erro ao processar login. Tente novamente.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-amber-600 p-8 text-center">
          <Cake className="w-16 h-16 text-white mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white font-serif">Taio Dagnoni</h1>
          <p className="text-amber-100 font-medium">Confeitaria Artística</p>
        </div>
      
        <div className="p-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-6">Acesso ao Sistema</h2>
          <form onSubmit={handleLogin}>
            <Input 
                label="Usuário ou Email" 
                type="text" 
                value={loginInput} 
                onChange={e => setLoginInput(e.target.value)} 
                placeholder="ex: admin"
            />
            <Input 
                label="Senha" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="******"
            />
            <Button type="submit" className="w-full justify-center mt-4" disabled={isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

// 2. DASHBOARD (CORRIGIDO: Problema de Data/Fuso Horário na Agenda e Bloqueios)
const Dashboard = () => {
  const { userProfile } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  
  // --- ESTADOS PARA EVENTOS E BLOQUEIOS ---
  const [customEvents, setCustomEvents] = useState([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isBlockingDates, setIsBlockingDates] = useState(false);
  
  const [newEventData, setNewEventData] = useState({ 
      date: '', 
      endDate: '', 
      description: '' 
  });
  
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [selectedDateForEvents, setSelectedDateForEvents] = useState(null);

  // FILTROS
  const [viewMode, setViewMode] = useState('table');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [specificDateFilter, setSpecificDateFilter] = useState(null);

  // ESTADOS DE EDIÇÃO
  const [editingRowId, setEditingRowId] = useState(null);
  const [tempRowData, setTempRowData] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(null); 

  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const years = [2025, 2026, 2027];
  const categories = ['Todas', ...EVENT_TYPES];

  const statusOptions = [
      { value: 'Não iniciado', label: 'Não iniciado', color: 'bg-stone-100 text-stone-600 border-stone-200' },
      { value: 'Em preparação', label: 'Em preparação', color: 'bg-amber-100 text-amber-700 border-amber-200' },
      { value: 'Entregue', label: 'Entregue', color: 'bg-green-100 text-green-700 border-green-200' }
  ];

  const paymentStatusOptions = [
      { value: 'Pendente', label: 'Pendente', color: 'bg-red-50 text-red-600 border-red-200' },
      { value: 'Parcial', label: 'Parcial (Entrada)', color: 'bg-orange-50 text-orange-600 border-orange-200' },
      { value: 'Pago', label: 'Pago Total', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
  ];

  const paymentMethods = ["Dinheiro", "Pix", "Cartão Débito", "Cartão Crédito à Vista", "Cartão Crédito Parcelado"];
  const entryMethods = ["Pix", "Dinheiro", "Cartão Débito"];

  // --- HELPER DE DATA SEGURO (CORREÇÃO DO FUSO) ---
  // Transforma string "AAAA-MM-DD" em objeto Date Local (00:00:00) sem alteração de dia
  const parseLocalDate = (dateString) => {
      if (!dateString) return null;
      const parts = dateString.split('-');
      // new Date(ano, mes-1, dia) cria a data no horário local do usuário
      return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  // 1. Carrega Orçamentos
  useEffect(() => {
    const q = query(getColRef('budgets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const budgetEvents = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => b.status === 'approved' && b.eventDate)
        .map(b => {
            // Usa o helper seguro para criar a data
            const localDate = parseLocalDate(b.eventDate);

            return {
                id: b.id,
                date: localDate,
                category: b.typeOfConfectionery || 'Eventos em Geral',
                client: b.clientData?.name,
                value: b.totalValue,
                items: b.items || [],
                orderStatus: b.orderStatus || 'Não iniciado',
                paymentMethod: b.paymentMethod || 'A definir', 
                paymentStatus: b.paymentStatus || 'Pendente',
                paymentDate: b.paymentDate || '', 
                remainingPaymentDate: b.remainingPaymentDate || '', 
                installments: b.installments || 1,
                entryValue: b.entryValue || 0,
                entryMethod: b.entryMethod || 'Pix' 
            };
        });
      setEvents(budgetEvents);
    });
    return () => unsubscribe();
  }, []);

  // 2. Carrega Eventos Personalizados
  useEffect(() => {
      const q = query(collection(getFirestore(), 'custom_events'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const loadedEvents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setCustomEvents(loadedEvents);
      });
      return () => unsubscribe();
  }, []);

  // --- HANDLERS EVENTOS ---
  const handleSaveCustomEvent = async () => {
      if(!newEventData.date || !newEventData.description) {
          alert("Preencha a data e a descrição.");
          return;
      }

      const finalDate = (isBlockingDates && newEventData.endDate) ? newEventData.endDate : newEventData.date;

      // Validação de datas segura
      const dStart = parseLocalDate(newEventData.date);
      const dEnd = parseLocalDate(finalDate);

      if (isBlockingDates && dEnd < dStart) {
          alert("A data final não pode ser anterior à inicial.");
          return;
      }

      setIsSavingEvent(true);
      try {
          await addDoc(collection(getFirestore(), 'custom_events'), {
              date: newEventData.date, // Salva string YYYY-MM-DD
              endDate: finalDate,      // Salva string YYYY-MM-DD
              description: newEventData.description,
              type: isBlockingDates ? 'block' : 'event',
              createdAt: serverTimestamp(),
              createdBy: userProfile?.email || 'Sistema'
          });
          
          alert(isBlockingDates ? "Agenda bloqueada com sucesso!" : "Evento criado com sucesso!");
          setIsEventModalOpen(false);
          setNewEventData({ date: '', endDate: '', description: '' });
          setIsBlockingDates(false);

      } catch (error) {
          console.error("Erro ao salvar:", error);
          alert("Erro ao salvar.");
      } finally {
          setIsSavingEvent(false);
      }
  };

  const handleDeleteCustomEvent = async (id) => {
      if(confirm("Excluir este item da agenda?")) {
          try {
              await deleteDoc(doc(collection(getFirestore(), 'custom_events'), id));
          } catch (error) {
              console.error(error);
          }
      }
  };

  // --- HANDLERS EDIÇÃO TABELA (Mantidos) ---
  const startEditing = (evt) => {
      setEditingRowId(evt.id);
      setTempRowData({
          orderStatus: evt.orderStatus,
          paymentMethod: evt.paymentMethod,
          paymentStatus: evt.paymentStatus,
          paymentDate: evt.paymentDate,
          remainingPaymentDate: evt.remainingPaymentDate,
          installments: evt.installments,
          entryValue: evt.entryValue,
          entryMethod: evt.entryMethod
      });
  };

  const cancelEditing = () => { setEditingRowId(null); setTempRowData({}); };
  const handleTempChange = (field, value) => { setTempRowData(prev => ({ ...prev, [field]: value })); };

  const saveRow = async (id) => {
      try {
          // LÓGICA: Se a data do pagamento restante é preenchida, muda automaticamente para "Pago"
          let finalPaymentStatus = tempRowData.paymentStatus;
          if (tempRowData.remainingPaymentDate) {
              finalPaymentStatus = 'Pago';
          }

          await updateDoc(doc(getColRef('budgets'), id), {
              orderStatus: tempRowData.orderStatus,
              paymentMethod: tempRowData.paymentMethod,
              paymentStatus: finalPaymentStatus,
              paymentDate: tempRowData.paymentDate || null,
              remainingPaymentDate: tempRowData.remainingPaymentDate || null, 
              installments: tempRowData.installments,
              entryValue: tempRowData.entryValue,
              entryMethod: tempRowData.entryMethod
          });
          setEditingRowId(null);
      } catch (error) {
          console.error("Erro ao salvar:", error);
          alert("Erro ao salvar alterações.");
      }
  };

  // --- FILTROS ---
  const filteredEvents = events.filter(e => {
    if (specificDateFilter) {
        return (
            e.date.getDate() === specificDateFilter.getDate() &&
            e.date.getMonth() === specificDateFilter.getMonth() &&
            e.date.getFullYear() === specificDateFilter.getFullYear()
        );
    }
    const yearMatch = e.date.getFullYear() === parseInt(selectedYear);
    const monthMatch = parseInt(selectedMonth) === -1 ? true : e.date.getMonth() === parseInt(selectedMonth);
    const categoryMatch = selectedCategory === 'Todas' ? true : e.category === selectedCategory;
    return yearMatch && monthMatch && categoryMatch;
  });

  const handleMonthChange = (val) => { setSelectedMonth(parseInt(val)); setSpecificDateFilter(null); };
  const handleYearChange = (val) => { setSelectedYear(parseInt(val)); setSpecificDateFilter(null); };
  const handleCategoryChange = (val) => { setSelectedCategory(val); setSpecificDateFilter(null); };
  const handleDayClick = (date) => { setSpecificDateFilter(date); setViewMode('table'); };
  const clearDateFilter = () => { setSpecificDateFilter(null); };

  const totalDeliveries = filteredEvents.length;
  const totalRevenue = filteredEvents.reduce((acc, curr) => acc + (curr.value || 0), 0);

  const currentMonthIndex = selectedMonth === -1 ? 0 : selectedMonth;
  const daysInMonth = new Date(selectedYear, parseInt(currentMonthIndex) + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDayOfWeek = new Date(selectedYear, currentMonthIndex, 1).getDay();

  // Estilos
  const getCategoryColor = (cat) => {
      switch(cat) {
          case 'Casamento': return 'bg-pink-50 text-pink-700 border-pink-200 ring-1 ring-pink-100';
          case 'Aniversário': return 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-100';
          case 'Primeira Eucaristia/Crisma': return 'bg-yellow-50 text-yellow-700 border-yellow-200 ring-1 ring-yellow-100';
          case 'Natal': return 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-100';
          case 'Páscoa': return 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-100';
          case 'Confraternização': return 'bg-orange-50 text-orange-700 border-orange-200 ring-1 ring-orange-100';
          case 'Batizado': return 'bg-cyan-50 text-cyan-700 border-cyan-200 ring-1 ring-cyan-100';
          default: return 'bg-stone-50 text-stone-600 border-stone-200';
      }
  };

  const getCategoryCountsForDay = (dayEvents) => {
      const counts = {};
      dayEvents.forEach(evt => { counts[evt.category] = (counts[evt.category] || 0) + 1; });
      return Object.entries(counts);
  };

  const getStatusStyle = (status) => statusOptions.find(o => o.value === status)?.color || 'bg-stone-100';
  const getPaymentStatusStyle = (status) => paymentStatusOptions.find(o => o.value === status)?.color || 'bg-stone-100';

  const formatPaymentDate = (dateString) => {
      if (!dateString) return '';
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
  };

  const formatDateBR = (dateStr) => {
      if(!dateStr) return '';
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
  };

  // --- FUNÇÃO PARA CHECAR SE O DIA ESTÁ BLOQUEADO (CORRIGIDA COM PARSE SEGURO) ---
  const checkIsDayBlocked = (currentDate) => {
      // Normaliza o dia atual do loop para 00:00:00 local
      const checkDate = new Date(currentDate);
      checkDate.setHours(0,0,0,0);

      // Procura bloqueios
      const block = customEvents.find(ev => {
          if (ev.type !== 'block') return false;
          
          // Usa o helper seguro para criar as datas de inicio e fim do bloqueio
          const start = parseLocalDate(ev.date);
          start.setHours(0,0,0,0);
          
          // Se não tiver endDate, assume que é só um dia
          const end = ev.endDate ? parseLocalDate(ev.endDate) : parseLocalDate(ev.date);
          end.setHours(23,59,59,999);

          // Verifica se o dia atual está dentro do intervalo
          return checkDate >= start && checkDate <= end;
      });

      return block;
  };

  return (
    <div className="space-y-6">
      {/* HEADER E FILTROS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
        <div className="w-full xl:w-auto">
           <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-800 tracking-tight">Painel Geral</h2>
           <p className="text-stone-500 mt-1 text-sm md:text-base">Bem-vindo, {userProfile?.name}</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
            
            {viewMode === 'agenda' && (
                <button 
                    onClick={() => {
                        setIsEventModalOpen(true);
                        setIsBlockingDates(false);
                        setNewEventData({ date: '', endDate: '', description: '' });
                    }} 
                    className="bg-stone-800 hover:bg-stone-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-colors"
                >
                    <CalendarPlus size={16} /> <span className="hidden md:inline">Criar Evento</span>
                </button>
            )}

            {specificDateFilter ? (
                <button onClick={clearDateFilter} className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-amber-200 transition-colors animate-in fade-in">
                    <RotateCcw size={16} /> Voltar para Visão Mensal
                </button>
            ) : (
                <div className="flex flex-wrap gap-2 bg-stone-50 p-1.5 rounded-xl border border-stone-200 w-full md:w-auto items-end">
                    <div className="relative group flex-1 md:flex-none">
                        <label className="absolute -top-2.5 left-2 bg-stone-50 px-1 text-[10px] font-bold text-amber-600 uppercase tracking-wider z-10">Mês</label>
                        <select value={selectedMonth} onChange={(e) => handleMonthChange(e.target.value)} className="h-10 pl-3 pr-8 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 outline-none w-full md:w-32 appearance-none"><option value="-1">Todo o Ano</option>{months.map((m, index) => <option key={index} value={index}>{m}</option>)}</select>
                    </div>
                    <div className="relative group flex-1 md:flex-none">
                        <label className="absolute -top-2.5 left-2 bg-stone-50 px-1 text-[10px] font-bold text-amber-600 uppercase tracking-wider z-10">Ano</label>
                        <select value={selectedYear} onChange={(e) => handleYearChange(e.target.value)} className="h-10 pl-3 pr-4 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 outline-none w-full md:w-auto">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
                    </div>
                    <div className="relative group flex-1 md:flex-none min-w-[150px]">
                        <label className="absolute -top-2.5 left-2 bg-stone-50 px-1 text-[10px] font-bold text-amber-600 uppercase tracking-wider z-10">Tipo de Evento</label>
                        <select value={selectedCategory} onChange={(e) => handleCategoryChange(e.target.value)} className="h-10 pl-3 pr-8 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 outline-none w-full appearance-none cursor-pointer">{categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}</select>
                    </div>
                </div>
            )}

            <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 w-full md:w-auto">
                <button onClick={() => { setViewMode('table'); }} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${viewMode === 'table' ? 'bg-white shadow text-amber-600' : 'text-stone-400'}`}><Filter size={16} /> Tabela</button>
                <button onClick={() => { if(!specificDateFilter) setViewMode('agenda'); }} disabled={!!specificDateFilter} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${viewMode === 'agenda' ? 'bg-white shadow text-amber-600' : 'text-stone-400'} ${specificDateFilter ? 'opacity-50 cursor-not-allowed' : ''}`}><Calendar size={16} /> Agenda</button>
            </div>
        </div>
      </div>

      <Card>
        <h3 className="text-lg font-bold text-stone-800 mb-6 flex flex-wrap items-center gap-2 pb-4 border-b border-stone-100">
          {viewMode === 'agenda' ? <Calendar className="text-amber-600" /> : <Filter className="text-amber-600" />} 
          {specificDateFilter ? (<span className="text-amber-600">Entregas do dia {specificDateFilter.toLocaleDateString()}</span>) : (<>{viewMode === 'agenda' ? 'Agenda Visual' : 'Lista de Entregas'} <span className="text-stone-400 font-normal text-sm ml-0 md:ml-2 bg-stone-100 px-2 py-0.5 rounded-full mt-1 md:mt-0">{selectedMonth === -1 ? `Ano de ${selectedYear}` : `${months[selectedMonth]} / ${selectedYear}`}{selectedCategory !== 'Todas' && ` • ${selectedCategory}`}</span></>)}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-white text-amber-600 rounded-full shadow-sm"><ShoppingBag size={24}/></div>
                <div><p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Entregas</p><p className="text-2xl font-bold text-stone-800">{totalDeliveries}</p></div>
            </div>
            <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-white text-stone-600 rounded-full shadow-sm"><DollarSign size={24}/></div>
                <div><p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Faturamento</p><p className="text-2xl font-bold text-amber-600">{totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
            </div>
        </div>

        {viewMode === 'table' && (
            <div className="overflow-x-auto rounded-lg border border-stone-100 pb-20 md:pb-0"> 
                {/* ... CONTEÚDO TABELA ... */}
                <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                        <tr className="bg-stone-50/80 text-stone-500 text-xs uppercase tracking-wider font-bold">
                            <th className="p-4 w-28">Data</th>
                            <th className="p-4">Cliente / Pedido</th>
                            <th className="p-4 w-32">Tipo</th> 
                            <th className="p-4 w-40 text-center">Status Produção</th>
                            <th className="p-4 w-48 text-center">Status Pagto</th> 
                            <th className="p-4 min-w-[200px]">Método Pagamento</th> 
                            <th className="p-4 text-right">Total</th>
                            <th className="p-4 w-20 text-center">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                        {filteredEvents.length > 0 ? (
                            filteredEvents.sort((a,b) => a.date - b.date).map((evt) => {
                                const isEditing = editingRowId === evt.id;
                                return (
                                <tr key={evt.id} className={`transition-colors ${isEditing ? 'bg-amber-50/50' : 'hover:bg-amber-50/20'}`}>
                                    <td className="p-4">
                                        <div className="flex flex-col items-center justify-center bg-stone-100 rounded-lg p-2 w-20 text-center border border-stone-200">
                                            <span className="text-xs font-bold text-stone-400 uppercase">{evt.date.toLocaleString('default', { month: 'short' })}</span>
                                            <span className="text-xl font-bold text-stone-800">{evt.date.getDate()}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <button onClick={() => setSelectedOrder(evt)} className="text-lg font-bold text-stone-800 hover:text-amber-600 text-left truncate max-w-[200px]">{evt.client}</button>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap ${getCategoryColor(evt.category)}`}>{evt.category}</span>
                                    </td>
                                    <td className="p-4 align-middle text-center">
                                        {isEditing ? (
                                            <select value={tempRowData.orderStatus} onChange={(e) => handleTempChange('orderStatus', e.target.value)} className="px-2 py-1 rounded border border-amber-300 bg-white text-xs w-full outline-none">{statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                                        ) : (
                                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border inline-block w-full ${getStatusStyle(evt.orderStatus)}`}>{evt.orderStatus}</span>
                                        )}
                                    </td>
                                    <td className="p-4 align-middle text-center">
                                        {isEditing ? (
                                            <div className="flex flex-col gap-2">
                                                <select value={tempRowData.paymentStatus} onChange={(e) => handleTempChange('paymentStatus', e.target.value)} className="px-2 py-1 rounded border border-amber-300 bg-white text-xs w-full outline-none">{paymentStatusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                                                {tempRowData.paymentStatus !== 'Pendente' && (
                                                    <div className="flex flex-col gap-2 bg-white/50 p-1 rounded">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] text-stone-500 font-bold uppercase text-left">{tempRowData.paymentStatus === 'Parcial' ? 'Data Entrada:' : 'Data Pagto:'}</label>
                                                            <input type="date" value={tempRowData.paymentDate || ''} onChange={(e) => handleTempChange('paymentDate', e.target.value)} className="px-1 py-1 rounded border border-stone-300 bg-white text-xs outline-none w-full" />
                                                        </div>
                                                        {tempRowData.paymentStatus === 'Parcial' && (
                                                            <div className="flex flex-col gap-1">
                                                                <label className="text-[10px] text-stone-500 font-bold uppercase text-left">Data Restante:</label>
                                                                <input type="date" value={tempRowData.remainingPaymentDate || ''} onChange={(e) => handleTempChange('remainingPaymentDate', e.target.value)} className="px-1 py-1 rounded border border-stone-300 bg-white text-xs outline-none w-full" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {tempRowData.paymentStatus === 'Parcial' && (
                                                    <div className="flex gap-1">
                                                        <input type="number" placeholder="R$" value={tempRowData.entryValue || ''} onChange={(e) => handleTempChange('entryValue', parseFloat(e.target.value))} className="w-1/2 px-1 py-1 rounded border border-orange-300 bg-white text-xs outline-none text-orange-700 font-bold placeholder-orange-300" />
                                                        <select value={tempRowData.entryMethod || 'Pix'} onChange={(e) => handleTempChange('entryMethod', e.target.value)} className="w-1/2 px-1 py-1 rounded border border-orange-300 bg-white text-[10px] outline-none text-orange-700 font-bold">{entryMethods.map(m => <option key={m} value={m}>{m}</option>)}</select>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border inline-block w-full ${getPaymentStatusStyle(evt.paymentStatus)}`}>{evt.paymentStatus}</span>
                                                {evt.paymentStatus !== 'Pendente' && evt.paymentDate && (
                                                    <div className="text-[10px] text-stone-500 mt-1 font-medium bg-stone-100 px-2 rounded-full border border-stone-200 whitespace-nowrap">{evt.remainingPaymentDate ? 'Entrada: ' : (evt.paymentStatus === 'Parcial' ? 'Entrada: ' : 'Pago em: ')} {formatPaymentDate(evt.paymentDate)}</div>
                                                )}
                                                {evt.remainingPaymentDate && (
                                                     <div className="text-[10px] text-stone-500 mt-1 font-medium bg-stone-100 px-2 rounded-full border border-stone-200 whitespace-nowrap">Restante: {formatPaymentDate(evt.remainingPaymentDate)}</div>
                                                )}
                                                {evt.entryValue > 0 && (
                                                    <div className="text-[10px] text-orange-600 font-bold mt-1 text-center leading-tight">Entrada: R$ {evt.entryValue.toFixed(2)}<br/><span className="opacity-75">via {evt.entryMethod || 'Pix'}</span></div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 align-middle">
                                        {isEditing ? (
                                            <div className="flex flex-col gap-1">
                                                <select value={tempRowData.paymentMethod} onChange={(e) => handleTempChange('paymentMethod', e.target.value)} className="bg-white border border-amber-300 text-stone-700 text-xs rounded px-2 py-1 outline-none w-full"><option value="" disabled>Selecione...</option>{paymentMethods.map(pm => <option key={pm} value={pm}>{pm}</option>)}</select>
                                                {tempRowData.paymentMethod === 'Cartão Crédito Parcelado' && (<select value={tempRowData.installments} onChange={(e) => handleTempChange('installments', parseInt(e.target.value))} className="bg-white border border-amber-300 text-stone-800 text-xs rounded px-1 py-1 outline-none font-bold text-center w-full">{Array.from({ length: 12 }, (_, i) => i + 1).map(num => <option key={num} value={num}>{num}x</option>)}</select>)}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-stone-600 font-medium">{evt.paymentMethod} {evt.paymentMethod === 'Cartão Crédito Parcelado' && <span className="text-xs font-bold ml-1 bg-stone-100 px-1 rounded text-stone-500">({evt.installments}x)</span>}</div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right align-middle">
                                        <span className="font-serif text-lg font-bold text-stone-800 whitespace-nowrap">R$ {evt.value?.toFixed(2)}</span>
                                    </td>
                                    <td className="p-4 align-middle text-center">
                                        {isEditing ? (
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => saveRow(evt.id)} className="p-1.5 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors"><CheckCircle size={18} /></button>
                                                <button onClick={cancelEditing} className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"><X size={18} /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => startEditing(evt)} className="p-2 text-stone-400 hover:text-amber-600 hover:bg-stone-100 rounded-lg transition-colors mx-auto block"><Edit2 size={18} /></button>
                                        )}
                                    </td>
                                </tr>
                            )})
                        ) : (
                            <tr><td colSpan="8" className="p-12 text-center text-stone-400 italic">Nenhum agendamento encontrado para este filtro.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {viewMode === 'agenda' && (
             selectedMonth === -1 ? (
                <div className="p-8 text-center border-2 border-dashed border-stone-200 rounded-xl bg-stone-50">
                    <p className="text-stone-500">Selecione um mês específico para ver a grade diária.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                        <div className="grid grid-cols-7 gap-2 text-center text-sm mb-3 text-stone-400 font-bold uppercase">
                            <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sab</div>
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} className="min-h-[100px]"></div>)}
                        {days.map(day => {
                            const currentDayDate = new Date(selectedYear, selectedMonth, day);
                            const dateString = currentDayDate.toISOString().split('T')[0];

                            // Verifica se é dia BLOQUEADO (Corrigido)
                            const blockedEvent = checkIsDayBlocked(currentDayDate);

                            const dayEvents = events.filter(e => 
                                e.date.getDate() === day && 
                                e.date.getMonth() === selectedMonth && 
                                e.date.getFullYear() === selectedYear &&
                                (selectedCategory === 'Todas' ? true : e.category === selectedCategory)
                            );
                            
                            // Filtra eventos personalizados usando comparação de string direta (mais seguro)
                            const dayCustomEvents = customEvents.filter(e => e.date === dateString && e.type !== 'block');

                            const isToday = day === new Date().getDate() && selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();
                            const categoryCounts = getCategoryCountsForDay(dayEvents);
                            
                            const boxStyle = blockedEvent 
                                ? 'bg-red-50 border-red-200 ring-1 ring-red-100' 
                                : ((dayEvents.length > 0 || dayCustomEvents.length > 0) ? 'bg-white border-amber-200 hover:shadow-md' : 'bg-stone-50/30 border-stone-100');

                            return (
                            <div key={day} onClick={() => !blockedEvent && dayEvents.length > 0 && handleDayClick(currentDayDate)} className={`min-h-[100px] border rounded-xl p-2 text-left relative transition-all duration-200 ${boxStyle} ${isToday ? 'ring-2 ring-amber-400 bg-white' : ''}`}>
                                <span className={`text-sm font-bold ml-1 block mb-2 ${isToday ? 'text-amber-600' : 'text-stone-400'}`}>{day}</span>
                                
                                <div className="space-y-1">
                                    {blockedEvent && (
                                        <div onClick={(e) => { e.stopPropagation(); setSelectedDateForEvents(dateString); }} className="bg-red-100 border border-red-200 text-red-600 text-[10px] font-bold px-2 py-1.5 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-200"><XCircle size={12} className="mr-1"/> FECHADO</div>
                                    )}

                                    {!blockedEvent && categoryCounts.map(([catName, count]) => (
                                        <div key={catName} className={`text-[10px] px-2 py-1 rounded-md font-bold flex justify-between items-center ${getCategoryColor(catName)} cursor-pointer`}><span className="truncate mr-1">{catName}</span><span className="bg-white/50 px-1.5 rounded text-[9px]">{count}</span></div>
                                    ))}

                                    {!blockedEvent && dayCustomEvents.length > 0 && (
                                        <div onClick={(e) => { e.stopPropagation(); setSelectedDateForEvents(dateString); }} className="text-[10px] px-2 py-1 rounded-md font-bold flex justify-center items-center bg-stone-100 text-stone-600 border border-stone-200 mt-1 cursor-pointer hover:bg-stone-200 transition-colors">{dayCustomEvents.length} Lembrete(s)</div>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                        </div>
                    </div>
                </div>
            )
        )}
      </Card>

      {/* MODAL DETALHES ORÇAMENTO (MANTIDO) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl shadow-2xl relative border-t-4 border-t-amber-600 max-h-[90vh] flex flex-col">
                <button onClick={() => setSelectedOrder(null)} className="absolute top-4 right-4 text-stone-400 hover:text-red-500 bg-stone-100 rounded-full p-2"><XCircle size={20} /></button>
                <div className="mb-4 border-b pb-4 shrink-0">
                    <div className="flex justify-between items-start pr-8">
                        <div><h3 className="text-xl font-serif font-bold text-stone-800">Detalhes do Pedido</h3><p className="text-amber-600 font-semibold text-lg">{selectedOrder.client}</p></div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${getCategoryColor(selectedOrder.category)}`}>{selectedOrder.category}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-stone-500 mt-2 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar size={12} /> Entrega: {selectedOrder.date.toLocaleDateString()}</span>
                        <span className="flex items-center gap-1 font-bold text-stone-700"><CheckCircle size={12} /> {selectedOrder.orderStatus}</span>
                        {selectedOrder.paymentMethod && <span className="flex items-center gap-1 font-bold text-stone-700"><CreditCard size={12} /> {selectedOrder.paymentMethod} {selectedOrder.installments > 1 ? `(${selectedOrder.installments}x)` : ''}</span>}
                        {selectedOrder.paymentDate && <span className="flex items-center gap-1 font-bold text-emerald-600 border border-emerald-100 bg-emerald-50 px-2 py-0.5 rounded-full"><Calendar size={12} /> Pago em: {formatPaymentDate(selectedOrder.paymentDate)}</span>}
                    </div>
                </div>
                <div className="overflow-y-auto overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-sm min-w-[500px]">
                        <thead className="bg-stone-50 text-stone-600 font-semibold"><tr><th className="p-3 text-center w-16">Qtd</th><th className="p-3 text-left">Categoria</th><th className="p-3 text-left">Item / Descrição</th><th className="p-3 text-right">Total</th></tr></thead>
                        <tbody className="divide-y divide-stone-100">{selectedOrder.items && selectedOrder.items.map((item, idx) => (<tr key={idx}><td className="p-3 text-center font-bold text-amber-600">{item.qty || 1}</td><td className="p-3"><span className="text-[10px] uppercase font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-full">{item.category || '-'}</span></td><td className="p-3 text-stone-700 font-medium">{item.desc}</td><td className="p-3 text-right font-mono text-stone-500">R$ {(item.val || item.total || 0).toFixed(2)}</td></tr>))}</tbody>
                    </table>
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center shrink-0"><div className="text-xs text-stone-500 uppercase font-bold">Total Final</div><div className="text-xl font-serif font-bold text-stone-800">R$ {selectedOrder.value?.toFixed(2)}</div></div>
            </Card>
        </div>
      )}

      {/* MODAL CRIAR EVENTO */}
      {isEventModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                      <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                          <CalendarPlus size={18} className="text-amber-600"/> 
                          {isBlockingDates ? 'Bloquear Agenda' : 'Novo Evento'}
                      </h3>
                      <button onClick={() => setIsEventModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X size={20}/></button>
                  </div>
                  <div className="space-y-4">
                      <label className="flex items-center gap-2 p-2 border border-red-100 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
                          <input type="checkbox" checked={isBlockingDates} onChange={(e) => setIsBlockingDates(e.target.checked)} className="w-4 h-4 text-red-600 rounded focus:ring-red-500" />
                          <span className="text-sm font-bold text-red-600">Agenda Fechada / Bloqueio</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                          <div className={isBlockingDates ? '' : 'col-span-2'}>
                              <label className="block text-stone-600 text-[10px] font-bold uppercase mb-1">{isBlockingDates ? 'Data Inicial' : 'Data do Evento'}</label>
                              <input type="date" className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm" value={newEventData.date} onChange={(e) => setNewEventData({...newEventData, date: e.target.value})} />
                          </div>
                          {isBlockingDates && (
                              <div>
                                  <label className="block text-stone-600 text-[10px] font-bold uppercase mb-1">Data Final</label>
                                  <input type="date" className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm" value={newEventData.endDate} onChange={(e) => setNewEventData({...newEventData, endDate: e.target.value})} />
                              </div>
                          )}
                      </div>
                      <div>
                          <label className="block text-stone-600 text-sm font-semibold mb-1">{isBlockingDates ? 'Motivo do Fechamento' : 'Descrição'}</label>
                          <textarea rows="3" className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none resize-none text-sm" placeholder={isBlockingDates ? "Ex: Férias Coletivas, Manutenção..." : "Ex: Reunião fornecedor..."} value={newEventData.description} onChange={(e) => setNewEventData({...newEventData, description: e.target.value})} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                          <Button variant="secondary" onClick={() => setIsEventModalOpen(false)}>Cancelar</Button>
                          <Button onClick={handleSaveCustomEvent} disabled={isSavingEvent} className={isBlockingDates ? 'bg-red-600 hover:bg-red-700 text-white' : ''}>{isSavingEvent ? 'Salvando...' : (isBlockingDates ? 'Bloquear' : 'Salvar')}</Button>
                      </div>
                  </div>
              </Card>
          </div>
      )}

      {/* MODAL LISTAR/EXCLUIR */}
      {selectedDateForEvents && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                      <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">Agenda: {formatDateBR(selectedDateForEvents)}</h3>
                      <button onClick={() => setSelectedDateForEvents(null)} className="text-stone-400 hover:text-stone-600"><X size={20}/></button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
                      {customEvents.filter(e => {
                          if (e.date === selectedDateForEvents) return true;
                          if (e.type === 'block' && e.endDate) return selectedDateForEvents >= e.date && selectedDateForEvents <= e.endDate;
                          return false;
                      }).map(ce => (
                          <div key={ce.id} className={`p-3 rounded-lg flex justify-between items-start gap-3 border ${ce.type === 'block' ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200'}`}>
                              <div>
                                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mb-1 inline-block ${ce.type === 'block' ? 'bg-red-200 text-red-700' : 'bg-stone-200 text-stone-600'}`}>{ce.type === 'block' ? 'Bloqueio' : 'Lembrete'}</span>
                                  <p className="text-sm text-stone-700 font-medium leading-tight">{ce.description}</p>
                                  {ce.type === 'block' && ce.endDate && ce.endDate !== ce.date && (<p className="text-[10px] text-stone-400 mt-1">Até: {formatDateBR(ce.endDate)}</p>)}
                              </div>
                              <button onClick={() => handleDeleteCustomEvent(ce.id)} className="text-stone-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors shrink-0" title="Excluir"><Trash2 size={16}/></button>
                          </div>
                      ))}
                      {customEvents.filter(e => e.date === selectedDateForEvents).length === 0 && !checkIsDayBlocked(selectedDateForEvents) && (<p className="text-center text-stone-400 italic text-sm py-4">Nenhum item extra.</p>)}
                  </div>
                  <div className="mt-4 pt-2 border-t border-stone-100 flex justify-end"><Button variant="secondary" onClick={() => setSelectedDateForEvents(null)}>Fechar</Button></div>
              </Card>
          </div>
      )}
    </div>
  );
};

// 5. GESTÃO DE CLIENTES (CORRIGIDO: Atualização em Cascata nos Orçamentos)
const ClientsManager = () => {
  const { userProfile } = useContext(AuthContext);
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Armazena o nome original ao abrir edição para buscar nos orçamentos depois
  const [originalName, setOriginalName] = useState(''); 

  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '', cpf: '' });

  useEffect(() => {
    const q = query(getColRef('clients'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const openNewClientModal = () => {
      setEditingId(null);
      setOriginalName('');
      setFormData({ name: '', phone: '', email: '', address: '', cpf: '' });
      setIsModalOpen(true);
  };

  const openEditModal = (client) => {
      setEditingId(client.id);
      setOriginalName(client.name); // Guarda o nome antigo
      setFormData({
          name: client.name,
          phone: client.phone || '',
          email: client.email || '',
          address: client.address || '',
          cpf: client.cpf || ''
      });
      setIsModalOpen(true);
  };

  // --- FUNÇÃO DE SALVAR COM ATUALIZAÇÃO EM CASCATA ---
  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (!formData.name) {
        alert("O nome do cliente é obrigatório.");
        return;
    }

    setIsSaving(true);

    try {
      const clientPayload = {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          cpf: formData.cpf,
          updatedBy: userProfile?.email || 'Sistema',
          updatedAt: serverTimestamp()
      };

      if (editingId) {
          // 1. Atualiza o Cliente
          await updateDoc(doc(getColRef('clients'), editingId), clientPayload);

          // 2. ATUALIZAÇÃO EM CASCATA NOS ORÇAMENTOS
          // Se o nome mudou, precisamos atualizar todos os orçamentos antigos
          if (originalName && originalName !== formData.name) {
              
              // Busca orçamentos com o nome antigo
              const qBudgets = query(getColRef('budgets'), where('clientData.name', '==', originalName));
              const querySnapshot = await getDocs(qBudgets);

              // Cria uma lista de promessas para atualizar tudo de uma vez
              const updatePromises = querySnapshot.docs.map(budgetDoc => {
                  return updateDoc(budgetDoc.ref, {
                      'clientData.name': formData.name,   // Atualiza Nome
                      'clientData.phone': formData.phone  // Atualiza Telefone também
                  });
              });

              await Promise.all(updatePromises);
              console.log(`${updatePromises.length} orçamentos atualizados para o novo nome.`);
          }

          alert("Cliente e orçamentos vinculados atualizados com sucesso!");

      } else {
          // Criação normal
          await addDoc(getColRef('clients'), { ...clientPayload, createdAt: serverTimestamp() });
          alert("Cliente cadastrado com sucesso!");
      }
      setIsModalOpen(false);

    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      alert("Erro ao salvar dados.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
      // Opcional: Adicionar verificação se tem orçamentos antes de excluir
      if (confirm("Tem certeza que deseja excluir este cliente?")) {
          await deleteDoc(doc(getColRef('clients'), id));
      }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-serif font-bold text-stone-800">Meus Clientes</h2>
        <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 text-stone-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou telefone..." 
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <Button onClick={openNewClientModal}><Plus size={18} /> Novo Cliente</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="p-4 text-stone-600 font-semibold text-sm">Nome</th>
                  <th className="p-4 text-stone-600 font-semibold text-sm">Telefone</th>
                  <th className="p-4 text-stone-600 font-semibold text-sm">Email</th>
                  <th className="p-4 text-stone-600 font-semibold text-sm">CPF</th>
                  <th className="p-4 text-stone-600 font-semibold text-sm w-32 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredClients.map(client => (
                  <tr key={client.id} className="hover:bg-amber-50/30">
                    <td className="p-4 font-bold text-stone-800">{client.name}</td>
                    <td className="p-4 text-stone-600">{client.phone || '-'}</td>
                    <td className="p-4 text-stone-600">{client.email || '-'}</td>
                    <td className="p-4 text-stone-600">{client.cpf || '-'}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                          <button onClick={() => openEditModal(client)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Edit2 size={18} /></button>
                          <button onClick={() => handleDelete(client.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
        {filteredClients.length === 0 && <div className="p-8 text-center text-stone-400">Nenhum cliente encontrado.</div>}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b pb-2">
                <h3 className="text-xl font-serif font-bold text-stone-800">{editingId ? 'Editar Cliente' : 'Novo Cliente'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSaveClient} className="space-y-4">
              <Input label="Nome Completo *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ex: Maria da Silva" />
              <Input label="Telefone / WhatsApp" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(00) 00000-0000" />
              <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="cliente@email.com" />
              <Input label="CPF" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="000.000.000-00" />
              <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-stone-600">Endereço</label>
                  <textarea className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm" rows="3" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Rua, Número, Bairro..." />
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100">
                <Button variant="secondary" onClick={(e) => { e.preventDefault(); setIsModalOpen(false); }} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Salvando...' : 'Salvar Cliente'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

// 4. ORÇAMENTOS (ATUALIZADO: Múltiplas Imagens + PDF Correto)
const PaperInput = ({ className, ...props }) => (
    <input 
        {...props}
        className={`bg-transparent border-b border-stone-300 focus:border-amber-600 outline-none py-1 transition-colors font-medium text-stone-800 placeholder-stone-400 ${className}`} 
    />
);

const formatDateForDisplay = (isoDate) => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const BudgetManager = () => {
    const { userProfile, hasRole } = useContext(AuthContext);
    const [view, setView] = useState('list');
    const [budgets, setBudgets] = useState([]);
    const [clients, setClients] = useState([]);
    const [productsCatalog, setProductsCatalog] = useState([]);
    
    // NOVO: Estado para armazenar os bloqueios da agenda
    const [scheduleBlocks, setScheduleBlocks] = useState([]);
    const [dateWarning, setDateWarning] = useState(null); // Aviso visual de bloqueio

    // FILTROS
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState('all'); 

    // LISTA DE EVENTOS
    const EVENT_TYPES = [
      "Casamento", "Aniversário", "Primeira Eucaristia/Crisma", "Natal", 
      "Páscoa", "Confraternização", "Batizado", "Eventos em Geral"
    ];

    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const years = [2025, 2026, 2027];

    // FORMULÁRIO
    const [viewingBudgetID, setViewingBudgetID] = useState(null);
    const [selectedClient, setSelectedClient] = useState('');
    const [date, setDate] = useState('');
    const [confType, setConfType] = useState('Casamento');
    const [observations, setObservations] = useState('');
    
    // --- ALTERADO: Estados para Múltiplas Imagens ---
    const [attachments, setAttachments] = useState([]); // Lista de objetos { url: string }
    const [isUploading, setIsUploading] = useState(false);

    const [items, setItems] = useState([
        { category: '', desc: '', qty: 1, unitPrice: 0, discount: 0, showDiscount: false, total: 0, activeSearch: false, address: '' }
    ]);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        const q = query(getColRef('budgets'), where('status', '!=', 'deleted'));
        const unsubB = onSnapshot(q, (s) => setBudgets(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubC = onSnapshot(getColRef('clients'), (s) => setClients(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubP = onSnapshot(getColRef('products'), (s) => setProductsCatalog(s.docs.map(d => ({id: d.id, ...d.data()}))));
        
        // NOVO: Busca apenas os bloqueios da agenda
        const qBlocks = query(collection(getFirestore(), 'custom_events'), where('type', '==', 'block'));
        const unsubBlocks = onSnapshot(qBlocks, (s) => setScheduleBlocks(s.docs.map(d => d.data())));

        return () => { unsubB(); unsubC(); unsubP(); unsubBlocks(); }
    }, []);

    // NOVO: Função para verificar conflito de data
    const handleDateChange = (newDate) => {
        setDate(newDate);
        setDateWarning(null); // Reseta o aviso

        if (!newDate) return;

        // Cria data segura para comparação (zerando horas)
        const checkDate = new Date(newDate + 'T12:00:00'); 
        
        // Procura se cai em algum bloqueio
        const conflict = scheduleBlocks.find(block => {
            const start = new Date(block.date + 'T00:00:00');
            // Se não tiver endDate, considera apenas o dia inicial
            const end = block.endDate ? new Date(block.endDate + 'T23:59:59') : new Date(block.date + 'T23:59:59');
            
            return checkDate >= start && checkDate <= end;
        });

        if (conflict) {
            const msg = `Atenção, agenda fechada para o dia! Evento: ${conflict.description}`;
            alert(msg);
            setDateWarning(msg); // Define msg para exibir vermelho embaixo do input
        }
    };

    const hasAnyDiscount = items.some(i => i.showDiscount || i.discount > 0);
    const globalPendingCount = budgets.filter(b => b.status === 'pending').length;
    
    let displayedBudgets = [];
    if (statusFilter === 'pending') {
        displayedBudgets = budgets.filter(b => b.status === 'pending');
    } else {
        displayedBudgets = budgets.filter(b => {
            if (!b.eventDate) return false;
            const d = new Date(b.eventDate);
            const bYear = d.getFullYear();
            const bMonth = d.getMonth();
            if (selectedMonth === -1) return bYear === selectedYear;
            return bMonth === selectedMonth && bYear === selectedYear;
        });
    }

    const totalCount = displayedBudgets.length;
    const totalSum = displayedBudgets.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
    const grandTotalForm = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
    
    const handleToggleStatusFilter = () => {
        setStatusFilter(prev => prev === 'all' ? 'pending' : 'all');
    };

    const handleExportPDF = () => {
        setIsExporting(true);
        setTimeout(() => {
            if (!window.html2pdf) {
                const script = document.createElement('script');
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
                script.onload = generatePDF;
                document.body.appendChild(script);
            } 
            else {
                generatePDF();
            }
        }, 100);
    };

    const generatePDF = () => {
        const element = document.getElementById('budget-paper-content');
        const clientName = clients.find(c => c.id === selectedClient)?.name || 'Cliente';
        const dateFormatted = date.split('-').reverse().join('_');
        const fileName = `Orcamento_${clientName.replace(/\s+/g, '_')}_${dateFormatted}.pdf`;
        
        const opt = {
            margin: [10, 10, 15, 10], 
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] } 
        };
        
        window.html2pdf().set(opt).from(element).save().then(() => setIsExporting(false));
    };

    const handleDeleteBudget = async (e, id) => {
        e.stopPropagation();
        if (!hasRole(['admin', 'manager'])) return;
        if (confirm("Deseja mover este orçamento para a Lixeira? \nVocê poderá restaurá-lo na tela de Aprovações.")) {
            await updateDoc(doc(getColRef('budgets'), id), {
                status: 'deleted',
                deletedAt: serverTimestamp(),
                deletedBy: userProfile.username || userProfile.email
            });
        }
    };

    const handleDisapproveBudget = async (e, id) => {
        e.stopPropagation();
        if (!hasRole(['admin', 'manager'])) return;
        if (confirm("Tem certeza que deseja reverter este orçamento para PENDENTE?\nEle sairá do financeiro e voltará para a tela de Aprovações.")) {
            try {
                await updateDoc(doc(getColRef('budgets'), id), {
                    status: 'pending',
                    updatedBy: userProfile?.username || userProfile?.email || 'Sistema',
                    updatedAt: serverTimestamp()
                });
                alert("Orçamento retornado para aprovação!");
            } catch (error) {
                console.error("Erro ao reverter:", error);
                alert("Erro ao atualizar status.");
            }
        }
    };

    const handleOpenCreate = () => {
        setViewingBudgetID(null);
        setItems([{ category: '', desc: '', qty: 1, unitPrice: 0, discount: 0, showDiscount: false, total: 0, activeSearch: false, address: '' }]);
        setDate(''); 
        setDateWarning(null);
        setSelectedClient('');
        setConfType('Casamento');
        setObservations('');
        setAttachments([]); // Reseta a lista de anexos
        setView('form');
    };

    const handleOpenBudget = (budget) => {
        setViewingBudgetID(budget.id);
        setSelectedClient(budget.clientData?.id || '');
        // Ao abrir existente, usamos a mesma lógica para verificar se a data antiga agora está bloqueada
        setDate(budget.eventDate || '');
        // Pequeno hack: chama a verificação sem setar a data (já setada acima) para mostrar o aviso se houver
        if(budget.eventDate) {
            const checkDate = new Date(budget.eventDate + 'T12:00:00'); 
            const conflict = scheduleBlocks.find(block => {
                const start = new Date(block.date + 'T00:00:00');
                const end = block.endDate ? new Date(block.endDate + 'T23:59:59') : new Date(block.date + 'T23:59:59');
                return checkDate >= start && checkDate <= end;
            });
            if(conflict) setDateWarning(`Atenção: Data original deste orçamento está bloqueada: ${conflict.description}`);
            else setDateWarning(null);
        }

        setConfType(budget.typeOfConfectionery || 'Casamento');
        setObservations(budget.observations || '');
        
        // --- Lógica para carregar anexos (Compatibilidade com antigo e novo) ---
        let loadedAttachments = [];
        if (budget.attachments && Array.isArray(budget.attachments)) {
            // Se já usa o novo sistema de lista
            loadedAttachments = budget.attachments;
        } else if (budget.attachmentUrl) {
            // Se é um orçamento antigo com apenas uma foto
            loadedAttachments = [{ url: budget.attachmentUrl }];
        }
        setAttachments(loadedAttachments);
        
        const loadedItems = (budget.items || []).map(i => {
            const safeQty = parseFloat(i.qty) || 1;
            const safePrice = parseFloat(i.unitPrice) || 0;
            const safeDiscount = parseFloat(i.discount) || 0;
            const calculatedTotal = (safeQty * safePrice) - safeDiscount;

            return {
                category: i.category || '', 
                desc: i.desc || '', 
                qty: safeQty,
                unitPrice: safePrice, 
                discount: safeDiscount,
                showDiscount: safeDiscount > 0,
                total: calculatedTotal > 0 ? calculatedTotal : 0,
                activeSearch: false,
                address: i.address || ''
            };
        });
        setItems(loadedItems.length ? loadedItems : [{ category: '', desc: '', qty: 1, unitPrice: 0, discount: 0, showDiscount: false, total: 0, activeSearch: false, address: '' }]);
        setView('form');
    };

    // --- NOVA FUNÇÃO: Adicionar Múltiplas Imagens ---
    const handleImageAdd = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            
            // Verificação básica de tamanho para não travar o Firestore (ex: 500kb cada)
            const oversized = files.filter(f => f.size > 500 * 1024);
            if (oversized.length > 0) {
                alert(`Atenção: ${oversized.length} imagem(ns) muito grande(s) (>500KB). Elas podem não salvar.`);
            }

            const promises = files.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            });

            Promise.all(promises)
                .then(base64Images => {
                    // Adiciona as novas imagens à lista existente
                    const newAttachments = base64Images.map(url => ({ url }));
                    setAttachments(prev => [...prev, ...newAttachments]);
                })
                .catch(err => alert("Erro ao processar imagens. Tente novamente."));
        }
    };

    // --- NOVA FUNÇÃO: Remover Imagem da Lista ---
    const handleRemoveImage = (indexToRemove) => {
        setAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleSubmit = async () => {
        if (!selectedClient || !date) return alert("Preencha cliente e data.");
        
        if (dateWarning && !confirm(`ATENÇÃO: A data selecionada tem um bloqueio de agenda:\n"${dateWarning}"\n\nDeseja salvar mesmo assim?`)) {
            return;
        }

        setIsUploading(true);

        try {
            const clientObj = clients.find(c => c.id === selectedClient);
            const cleanItems = items.map(i => ({ 
                category: i.category, desc: i.desc, qty: i.qty, unitPrice: i.unitPrice, 
                discount: i.discount || 0, val: i.total, address: i.address || '' 
            })).filter(i => i.desc !== '');

            const creatorName = userProfile?.username || userProfile?.email || 'Sistema';

            // Prepara a lista de URLs para salvar
            const attachmentList = attachments.map(a => ({ url: a.url }));
            // Mantém a primeira imagem como capa para compatibilidade
            const mainCover = attachmentList.length > 0 ? attachmentList[0].url : '';

            const payload = {
                clientData: clientObj, 
                eventDate: date, 
                typeOfConfectionery: confType, 
                observations: observations,
                items: cleanItems,
                attachments: attachmentList, // Salva a lista completa
                attachmentUrl: mainCover,    // Salva a capa (compatibilidade)
                totalValue: grandTotalForm, 
                updatedBy: creatorName, 
                updatedAt: serverTimestamp()
            };

            if (viewingBudgetID) {
                await updateDoc(doc(getColRef('budgets'), viewingBudgetID), payload);
                alert("Orçamento atualizado!");
            } else {
                await addDoc(getColRef('budgets'), { 
                    ...payload, status: 'pending', createdBy: creatorName, createdAt: serverTimestamp() 
                });
                alert("Orçamento criado!");
            }
            
            setView('list');

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    // --- MANIPULAÇÃO DE ITENS (MANTIDA ORIGINAL) ---
    const addItem = () => setItems([...items, { category: '', desc: '', qty: 1, unitPrice: 0, discount: 0, showDiscount: false, total: 0, activeSearch: false, address: '' }]);
    
    const addAdditionalItem = () => {
        setItems([...items, { 
            category: 'Adicional', desc: '', qty: 1, unitPrice: 0, discount: 0, showDiscount: false, total: 0, activeSearch: false, address: '' 
        }]);
    };

    const removeItem = (indexToRemove) => {
        const newItems = items.filter((_, index) => index !== indexToRemove);
        setItems(newItems);
    };

    const addDeliveryItem = () => {
        setItems([...items, { 
            category: 'Entrega', desc: 'Taxa de Entrega', qty: 1, unitPrice: 0, discount: 0, showDiscount: false, total: 0, activeSearch: false, address: '' 
        }]);
    };

    const applyGlobalDiscount = () => {
        const percentStr = prompt("Digite a % de desconto para aplicar em todos os itens (ex: 5 para 5%):");
        if (percentStr === null) return;
        const percent = parseFloat(percentStr.replace(',', '.'));
        if (isNaN(percent) || percent < 0) {
            alert("Porcentagem inválida.");
            return;
        }
        const newItems = items.map(item => {
            const qty = item.qty || 0;
            const unitPrice = item.unitPrice || 0;
            const grossTotal = qty * unitPrice;
            const discountValue = grossTotal * (percent / 100);
            const newTotal = grossTotal - discountValue;
            return {
                ...item,
                discount: discountValue,
                showDiscount: discountValue > 0,
                total: newTotal > 0 ? newTotal : 0
            };
        });
        setItems(newItems);
    };

    const toggleDiscount = (index) => {
        const newItems = [...items];
        if (newItems[index].showDiscount) {
            newItems[index].discount = 0;
            newItems[index].total = newItems[index].qty * newItems[index].unitPrice;
        }
        newItems[index].showDiscount = !newItems[index].showDiscount;
        setItems(newItems);
    };

    const handleInputChange = (index, field, value) => {
        const newItems = [...items];
        if (field === 'desc') {
            newItems[index].desc = value;
            newItems[index].activeSearch = true; 
        } else if (field === 'address') {
            newItems[index].address = value;
        } else if (field === 'qty') {
            const qtd = value === '' ? '' : parseFloat(value);
            newItems[index].qty = qtd;
            const unitPrice = newItems[index].unitPrice || 0;
            const discount = newItems[index].discount || 0;
            if (typeof qtd === 'number') {
                newItems[index].total = (qtd * unitPrice) - discount;
            } else {
                newItems[index].total = 0;
            }
        }
        setItems(newItems);
    };

    const handlePriceChange = (index, value) => {
        const newItems = [...items];
        let v = value.replace("R$", "").replace(/\./g, "").replace(",", "."); 
        let floatVal = parseFloat(v);
        newItems[index].unitPrice = floatVal;
        const qty = newItems[index].qty || 0;
        const discount = newItems[index].discount || 0;
        if (typeof qty === 'number') {
            newItems[index].total = (qty * floatVal) - discount;
        }
        setItems(newItems);
    };

    const handleDiscountChange = (index, value) => {
        const newItems = [...items];
        let v = value.replace("R$", "").replace(/\./g, "").replace(",", "."); 
        let floatDiscount = parseFloat(v);
        if (isNaN(floatDiscount)) floatDiscount = 0;
        newItems[index].discount = floatDiscount;
        const qty = newItems[index].qty || 0;
        const unitPrice = newItems[index].unitPrice || 0;
        let newTotal = (qty * unitPrice) - floatDiscount;
        if (newTotal < 0) newTotal = 0;
        newItems[index].total = newTotal;
        setItems(newItems);
    };

    const selectProduct = (index, product) => {
        const newItems = [...items];
        newItems[index].category = product.category; newItems[index].desc = product.description; newItems[index].unitPrice = product.price;
        const currentQty = (typeof newItems[index].qty === 'number' && newItems[index].qty > 0) ? newItems[index].qty : 1;
        const currentDiscount = newItems[index].discount || 0;
        newItems[index].qty = currentQty; 
        newItems[index].total = (currentQty * product.price) - currentDiscount;
        newItems[index].activeSearch = false;
        setItems(newItems);
    };

    const closeSearch = (index) => setTimeout(() => {
        const newItems = [...items];
        if (newItems[index]) { newItems[index].activeSearch = false; setItems(newItems); }
    }, 200);

    return (
        <div className="space-y-6">
            {view === 'list' && (
                <div className="flex flex-col gap-6">
                   <div className="flex flex-col xl:flex-row justify-between items-end gap-4 bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                        <div className="w-full xl:w-auto">
                            <h2 className="text-3xl font-serif font-bold text-stone-800 tracking-tight">Orçamentos</h2>
                            <div className="flex flex-wrap gap-4 mt-4">
                                <div className="bg-stone-50 px-4 py-2 rounded-lg border border-stone-200 flex-1 md:flex-none"><span className="text-xs font-bold text-stone-500 uppercase tracking-wider">{statusFilter === 'pending' ? 'Total (Pendentes)' : 'Total (Período)'}</span><div className="text-2xl font-bold text-stone-800">{totalCount}</div></div>
                                <div className="bg-stone-50 px-4 py-2 rounded-lg border border-stone-200 flex-1 md:flex-none"><span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Valor (R$)</span><div className="text-2xl font-bold text-stone-800">{totalSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div></div>
                                <button onClick={handleToggleStatusFilter} className={`px-4 py-2 rounded-lg border flex-1 md:flex-none transition-all duration-200 flex flex-col justify-center ${statusFilter === 'pending' ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-400 ring-offset-1' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'}`}><span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">Pendentes {statusFilter === 'pending' && <Filter size={10} />}</span><div className="text-2xl font-bold text-amber-800">{globalPendingCount}</div></button>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-3 items-end w-full xl:w-auto">
                            {statusFilter !== 'pending' && (<div className="flex gap-3 bg-stone-50 p-1.5 rounded-xl border border-stone-200 w-full md:w-auto"><select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="h-10 pl-3 pr-8 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 outline-none w-full md:w-40 appearance-none"><option value="-1">Todos os meses</option>{months.map((m, index) => <option key={index} value={index}>{m}</option>)}</select><select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="h-10 pl-3 pr-4 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 outline-none w-full md:w-auto">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>)}
                            <Button onClick={handleOpenCreate} className="h-10 w-full md:w-auto justify-center"><Plus size={18} /> Novo</Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayedBudgets.length > 0 ? (
                            displayedBudgets.sort((a,b) => new Date(b.eventDate) - new Date(a.eventDate)).map(b => (
                                <div key={b.id} onClick={() => handleOpenBudget(b)} className="cursor-pointer group">
                                    <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6 hover:shadow-lg transition-all relative border-l-4 border-l-amber-500">
                                        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                                            {hasRole(['admin', 'manager']) && b.status === 'approved' && (
                                                <button 
                                                    onClick={(e) => handleDisapproveBudget(e, b.id)} 
                                                    className="p-1.5 text-stone-300 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
                                                    title="Reverter para Pendente (Desaprovar)"
                                                >
                                                    <RotateCcw size={16} />
                                                </button>
                                            )}
                                            {hasRole(['admin', 'manager']) && (
                                                <button 
                                                    onClick={(e) => handleDeleteBudget(e, b.id)} 
                                                    className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                    title="Mover para Lixeira"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            <Badge status={b.status} />
                                        </div>
                                        <h4 className="font-bold text-stone-800 text-lg pr-4 truncate mt-2">{b.clientData?.name}</h4>
                                        <p className="text-sm text-stone-500 mb-1">{b.typeOfConfectionery}</p>
                                        <p className="text-xs text-stone-400 mb-4 flex items-center gap-1"><span className="font-semibold">Criado por:</span> {b.createdBy || 'Sistema'}</p>
                                        <div className="flex justify-between items-end border-t border-stone-100 pt-4"><div className="text-xs text-stone-400 flex items-center gap-1"><Calendar size={12} /> {b.eventDate ? new Date(b.eventDate).toLocaleDateString() : 'Sem data'}</div><div className="text-xl font-bold text-amber-600">R$ {(b.totalValue || 0).toFixed(2)}</div></div>
                                    </div>
                                </div>
                            ))
                        ) : (<div className="col-span-full p-12 text-center bg-white rounded-xl border border-dashed"><FileText className="w-12 h-12 text-stone-300 mx-auto mb-2" /><p className="text-stone-500">{statusFilter === 'pending' ? 'Nenhuma pendência encontrada no sistema.' : 'Nenhum orçamento encontrado.'}</p></div>)}
                    </div>
                </div>
            )}

            {view === 'form' && (
                <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                    
                    {/* CONTAINER DO PDF */}
                    <div id="budget-paper-content" className="w-full max-w-4xl bg-white shadow-2xl min-h-[800px] print:min-h-0 p-6 md:p-12 flex flex-col print:shadow-none print:w-full print:p-0">
                       
                        {/* CABEÇALHO */}
                        <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-amber-600 pb-6 mb-8 gap-4 md:gap-0"
                             style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <div className="flex items-center gap-4 text-amber-600"><Cake size={48} /><div><h1 className="font-serif text-2xl md:text-3xl font-bold text-stone-800">Taio Dagnoni</h1><p className="text-sm font-serif italic text-stone-500">Confeitaria Artística</p></div></div>
                            <div className="text-left md:text-right text-stone-400 text-sm"><p>{new Date().toLocaleDateString()}</p>{viewingBudgetID && !isExporting && <p className="text-xs font-bold text-amber-600 mt-1 uppercase" data-html2canvas-ignore="true">Modo de Edição</p>}</div>
                        </div>
                        
                        {/* CONTEÚDO PRINCIPAL */}
                        <div className="space-y-8 h-auto">
                            {/* DADOS DO CLIENTE */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                <div className="flex flex-col"><label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Cliente</label>{isExporting ? (<div className="border-b border-stone-300 py-1 font-serif text-lg text-stone-800">{clients.find(c => c.id === selectedClient)?.name || ''}</div>) : (<select className="bg-transparent border-b border-stone-300 py-1 outline-none focus:border-amber-600 font-serif text-lg w-full" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}><option value="">Selecione um cliente...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}</div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Data do Evento</label>
                                    {isExporting ? (
                                        <div className="border-b border-stone-300 py-1 font-medium text-stone-800 font-serif text-lg">{formatDateForDisplay(date)}</div>
                                    ) : (
                                        <>
                                            <PaperInput type="date" value={date} onChange={e => handleDateChange(e.target.value)} />
                                            {/* AVISO VISUAL DE BLOQUEIO */}
                                            {dateWarning && (
                                                <div className="text-xs text-red-600 font-bold mt-1 bg-red-50 p-2 rounded border border-red-100 flex items-center gap-2 animate-pulse">
                                                    <AlertTriangle size={14} /> {dateWarning}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            {/* CATEGORIA */}
                            <div className="flex flex-col" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Categoria Principal</label>
                                {isExporting ? (
                                    <div className="border-b border-stone-300 py-1 font-serif text-lg text-stone-800">{confType}</div>
                                ) : (
                                    <select className="bg-transparent border-b border-stone-300 py-1 outline-none focus:border-amber-600 font-serif text-lg w-full" value={confType} onChange={e => setConfType(e.target.value)}>
                                        {EVENT_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* CONTAINER DA LISTA */}
                            <div className={isExporting ? "pt-6 w-full" : "pt-6 overflow-x-auto md:overflow-visible"}>
                                <div className={isExporting ? "w-full" : "min-w-[600px]"}>
                                    
                                    {/* CABEÇALHO DA TABELA */}
                                    <div className="grid grid-cols-12 gap-4 mb-2 border-b border-stone-200 pb-2 text-xs font-bold text-stone-400 uppercase tracking-wider" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                        <div className="col-span-3">Categoria</div>
                                        <div className={hasAnyDiscount ? "col-span-3" : "col-span-4"}>Item / Descrição</div>
                                        <div className="col-span-1 text-center">Qtd</div>
                                        <div className="col-span-2 text-right">Unitário</div>
                                        {hasAnyDiscount && <div className="col-span-1 text-right text-red-400 whitespace-nowrap">Desconto</div>}
                                        <div className="col-span-2 text-right">Total</div>
                                    </div>
                                    
                                    {/* LISTA DE ITENS */}
                                    <div className="space-y-3" style={{ pageBreakInside: 'auto' }}>
                                        {items.map((item, idx) => (
                                            <div key={idx} className="break-inside-avoid" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                                {/* Linha do Produto */}
                                                <div className="grid grid-cols-12 gap-4 items-center group relative">
                                                    <div className="col-span-3"><input readOnly value={item.category} className="w-full bg-stone-50 text-xs text-stone-500 p-1 rounded border border-transparent" placeholder="-" /></div>
                                                    
                                                    <div className={`${hasAnyDiscount ? "col-span-3" : "col-span-4"} relative`}>
                                                        {isExporting ? (
                                                            <div className="border-b border-stone-300 py-1 font-medium text-stone-800 text-sm whitespace-normal break-words leading-tight">{item.desc}</div>
                                                        ) : (
                                                            <>
                                                                <PaperInput placeholder="Busque o produto..." className="w-full" value={item.desc} onChange={e => handleInputChange(idx, 'desc', e.target.value)} onBlur={() => closeSearch(idx)} autoComplete="off" />
                                                                {item.activeSearch && item.desc.length > 0 && (<div className="absolute top-full left-0 w-full bg-white border border-stone-200 shadow-xl rounded-b-lg z-50 max-h-48 overflow-y-auto" data-html2canvas-ignore="true">{productsCatalog.filter(p => p.description.toLowerCase().includes(item.desc.toLowerCase())).map(p => (<div key={p.id} className="p-2 hover:bg-amber-50 cursor-pointer text-sm border-b border-stone-50 flex justify-between" onMouseDown={() => selectProduct(idx, p)}><span className="font-medium text-stone-800">{p.description}</span><span className="text-amber-600 font-bold text-xs">R$ {p.price.toFixed(2)}</span></div>))}</div>)}
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="col-span-1"><PaperInput type="number" min="1" className="w-full text-center" value={item.qty} onChange={e => handleInputChange(idx, 'qty', e.target.value)} /></div>
                                                    <div className="col-span-2 text-right">
                                                        {isExporting ? (
                                                            <span className="text-sm text-stone-500">{(item.unitPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                        ) : (
                                                            <input type="number" className="w-full text-right bg-transparent border-b border-transparent focus:border-amber-600 outline-none text-sm text-stone-500" value={item.unitPrice} onChange={e => handlePriceChange(idx, e.target.value)} placeholder="0.00" />
                                                        )}
                                                    </div>
                                                    
                                                    {hasAnyDiscount && (
                                                        <div className="col-span-1 text-right">
                                                            {item.showDiscount ? (
                                                                isExporting ? (
                                                                    <span className="text-xs text-red-500 whitespace-nowrap">- {(item.discount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                                ) : (
                                                                    <input type="number" className="w-full text-right bg-red-50 border-b border-red-200 focus:border-red-500 outline-none text-xs text-red-500 font-bold" value={item.discount} onChange={e => handleDiscountChange(idx, e.target.value)} placeholder="0.00" />
                                                                )
                                                            ) : (<span className="text-stone-300 text-center block">-</span>)}
                                                        </div>
                                                    )}

                                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                                        <span className="font-bold text-stone-800">{(item.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                        {!isExporting && (
                                                            <div className="flex items-center">
                                                                <button onClick={() => toggleDiscount(idx)} className={`p-1 rounded-full transition-colors ${item.showDiscount ? 'text-amber-600 bg-amber-50' : 'text-stone-300 hover:text-amber-500 hover:bg-amber-50'}`} title="Adicionar Desconto neste item"><Tag size={16} /></button>
                                                                <button onClick={() => removeItem(idx)} className="text-stone-300 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors ml-1" title="Remover este item"><Trash2 size={16} /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {item.category === 'Entrega' && (
                                                    <div className="mt-1 pl-2 pr-2 border-l-2 border-stone-200 ml-2">
                                                        {isExporting ? (
                                                            <div className="text-xs text-stone-600 italic">
                                                                <span className="font-bold not-italic">Endereço de Entrega:</span> {item.address}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">Endereço de Entrega:</span>
                                                                <input 
                                                                    type="text" 
                                                                    className="w-full bg-stone-50 border-b border-stone-200 text-xs py-1 px-2 focus:bg-white focus:border-amber-500 outline-none transition-colors"
                                                                    placeholder="Digite o endereço completo..."
                                                                    value={item.address}
                                                                    onChange={e => handleInputChange(idx, 'address', e.target.value)}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        
                                        <div className="flex gap-4 mt-4" data-html2canvas-ignore="true">
                                            <button onClick={addItem} className="flex items-center gap-2 text-amber-600 text-sm font-bold hover:text-amber-700 px-2 py-1 rounded hover:bg-amber-50 transition-colors"><Plus size={14} /> Adicionar Linha</button>
                                            
                                            {/* NOVO BOTÃO ADICIONAL */}
                                            <button onClick={addAdditionalItem} className="flex items-center gap-2 text-purple-600 text-sm font-bold hover:text-purple-700 px-2 py-1 rounded hover:bg-purple-50 transition-colors"><Plus size={14} /> Adicional</button>

                                            <button onClick={addDeliveryItem} className="flex items-center gap-2 text-stone-500 text-sm font-bold hover:text-stone-700 px-2 py-1 rounded hover:bg-stone-50 transition-colors"><Truck size={14} /> Adicionar Entrega</button>
                                            <button onClick={applyGlobalDiscount} className="flex items-center gap-2 text-blue-600 text-sm font-bold hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"><Percent size={14} /> Desconto Global</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* --- ÁREA DE UPLOAD DE FOTOS MÚLTIPLAS (CORRIGIDO PARA PDF) --- */}
                            <div className="mt-6 mb-4 break-inside-avoid">
                                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                    <Tag size={12} /> Anexos (Fotos de referência)
                                </label>
                                <div className={`p-4 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50 transition-colors ${!isExporting ? 'hover:bg-white hover:border-amber-300' : ''}`}>
                                    
                                    {/* Input de arquivo múltiplo - Escondido no PDF */}
                                    {!isExporting && (
                                        <div className="mb-4">
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                multiple
                                                onChange={handleImageAdd}
                                                className="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                                            />
                                            <p className="text-[10px] text-stone-400 mt-1 pl-2">Você pode selecionar várias fotos de uma vez.</p>
                                        </div>
                                    )}
                                    
                                    {attachments.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {attachments.map((file, index) => (
                                                <div key={index} className="relative group border border-stone-200 rounded-lg overflow-hidden bg-white">
                                                    <img 
                                                        src={file.url} 
                                                        alt={`Anexo ${index + 1}`} 
                                                        className="w-full h-32 object-contain"
                                                    />
                                                    {/* Botão de Remover - Escondido no PDF */}
                                                    {!isExporting && (
                                                        <button 
                                                            onClick={() => handleRemoveImage(index)}
                                                            className="absolute top-1 right-1 bg-white rounded-full p-1 text-red-500 shadow hover:bg-red-50 transition-colors opacity-80 hover:opacity-100"
                                                            title="Remover foto"
                                                        >
                                                            <XCircle size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center text-stone-400 text-xs italic py-2">Nenhuma imagem anexada.</p>
                                    )}
                                    
                                    {/* Mensagem informativa apenas na tela */}
                                    {!isExporting && attachments.length > 0 && (
                                        <p className="text-center text-xs text-stone-400 mt-4 italic">
                                            * As imagens acima sairão no final do PDF.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* CAMPO DE OBSERVAÇÕES */}
                        <div className="mt-4 mb-4 break-inside-avoid" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 block">Observações</label>
                            {isExporting ? (
                                <div className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed border border-stone-200 rounded p-4 min-h-[60px]">
                                    {observations || "Sem observações."}
                                </div>
                            ) : (
                                <textarea 
                                    className="w-full bg-stone-50 border border-stone-200 rounded-lg p-4 text-sm focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all min-h-[80px]"
                                    placeholder="Digite observações gerais sobre o pedido, detalhes de decoração, etc..."
                                    value={observations}
                                    onChange={e => setObservations(e.target.value)}
                                />
                            )}
                        </div>

                        {/* RODAPÉ */}
                        <div 
                            className="mt-auto border-t-2 border-stone-800 pt-8 pb-4 flex flex-col md:flex-row justify-between items-end gap-4 md:gap-0"
                            style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                        >
                            <div className="text-stone-400 text-xs w-full md:w-auto">
                                <p>Este orçamento é válido por 10 dias.</p>
                                <p className="mt-4">Assinatura do Responsável: __________________________________________</p>
                            </div>
                            <div className="text-right w-full md:w-auto">
                                <span className="block text-stone-500 text-sm font-bold uppercase tracking-widest">Total Estimado</span>
                                <span className="block text-4xl font-serif font-bold text-stone-900">{grandTotalForm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="sticky bottom-4 flex flex-wrap justify-center gap-3 mt-8 bg-white/90 backdrop-blur p-4 rounded-full shadow-lg border border-stone-200 print:hidden z-40 w-full max-w-2xl mx-auto">
                        <Button variant="secondary" onClick={() => setView('list')} className="flex-1 md:flex-none">Voltar</Button>
                        <Button variant="ghost" onClick={handleExportPDF} className="flex-1 md:flex-none">{isExporting ? '...' : <><Download size={18}/><span className="hidden sm:inline"> PDF</span></>}</Button>
                        <Button onClick={handleSubmit} className="flex-1 md:flex-none" disabled={isUploading}>
                            <Save size={18} /> {isUploading ? 'Enviando...' : (viewingBudgetID ? 'Atualizar' : 'Salvar')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

// 7. APROVAÇÕES, REJEITADOS E LIXEIRA (CORRIGIDO E ROBUSTO)
const Approvals = () => {
    const { hasRole, userProfile } = useContext(AuthContext);
    
    // Estados para as 3 listas
    const [pendingBudgets, setPendingBudgets] = useState([]);
    const [rejectedBudgets, setRejectedBudgets] = useState([]);
    const [deletedBudgets, setDeletedBudgets] = useState([]);
    
    // Controle das abas
    const [activeTab, setActiveTab] = useState('pending');

    useEffect(() => {
        // 1. Busca Pendentes
        const qPending = query(getColRef('budgets'), where('status', '==', 'pending'));
        const unsubPending = onSnapshot(qPending, (s) => setPendingBudgets(s.docs.map(d => ({id: d.id, ...d.data()}))));
        
        // 2. Busca Rejeitados
        const qRejected = query(getColRef('budgets'), where('status', '==', 'rejected'));
        const unsubRejected = onSnapshot(qRejected, (s) => setRejectedBudgets(s.docs.map(d => ({id: d.id, ...d.data()}))));
        
        // 3. Busca Excluídos (apenas se for admin/manager)
        let unsubDeleted = () => {};
        if (hasRole(['admin', 'manager'])) {
            const qDeleted = query(getColRef('budgets'), where('status', '==', 'deleted'));
            unsubDeleted = onSnapshot(qDeleted, (s) => setDeletedBudgets(s.docs.map(d => ({id: d.id, ...d.data()}))));
        }

        return () => { unsubPending(); unsubRejected(); unsubDeleted(); };
    }, [hasRole]); // Executa novamente se o papel do usuário mudar

    // --- AÇÕES ---

    const handleApprove = async (id) => {
        await updateDoc(doc(getColRef('budgets'), id), { status: 'approved' });
    };

    const handleReject = async (id) => {
        if (confirm("Deseja rejeitar este orçamento? Ele irá para a aba 'Rejeitados'.")) {
            await updateDoc(doc(getColRef('budgets'), id), { status: 'rejected' });
        }
    };

    const handleRestore = async (id) => {
        if (confirm("Deseja restaurar este orçamento para a lista de Pendentes?")) {
            await updateDoc(doc(getColRef('budgets'), id), { status: 'pending' });
        }
    };

    const handleSoftDelete = async (id) => {
        if (confirm("Mover para a lixeira?")) {
            await updateDoc(doc(getColRef('budgets'), id), { 
                status: 'deleted',
                deletedBy: userProfile?.name || 'Sistema'
            });
        }
    };
    
    const handlePermanentDelete = async (id) => {
        if (confirm("ATENÇÃO: Isso apagará o orçamento para sempre do banco de dados. Confirmar?")) {
             await deleteDoc(doc(getColRef('budgets'), id));
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-serif font-bold text-stone-800">Central de Aprovações</h2>
            
            {/* BARRA DE ABAS */}
            <div className="flex gap-2 md:gap-4 border-b border-stone-200 overflow-x-auto pb-1">
                <button 
                    onClick={() => setActiveTab('pending')}
                    className={`pb-2 px-3 text-sm font-bold transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'pending' ? 'border-amber-600 text-amber-700' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                >
                    <AlertTriangle size={14} /> Pendentes ({pendingBudgets.length})
                </button>
                
                <button 
                    onClick={() => setActiveTab('rejected')}
                    className={`pb-2 px-3 text-sm font-bold transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'rejected' ? 'border-red-400 text-red-500' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                >
                    <XCircle size={14} /> Rejeitados ({rejectedBudgets.length})
                </button>

                {hasRole(['admin', 'manager']) && (
                    <button 
                        onClick={() => setActiveTab('deleted')}
                        className={`pb-2 px-3 text-sm font-bold transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'deleted' ? 'border-stone-500 text-stone-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                    >
                        <Trash2 size={14} /> Lixeira ({deletedBudgets.length})
                    </button>
                )}
            </div>

            <Card className="min-h-[300px]">
                {/* 1. CONTEÚDO: PENDENTES */}
                {activeTab === 'pending' && (
                    <div className="space-y-4">
                        {pendingBudgets.length === 0 ? (
                            <div className="text-center py-12 text-stone-400 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                                <p>Nenhuma pendência encontrada.</p>
                            </div>
                        ) : (
                            pendingBudgets.map(b => (
                                <div key={b.id} className="flex flex-col md:flex-row justify-between items-center p-4 border rounded-lg bg-stone-50 hover:shadow-md transition-all gap-4">
                                    <div>
                                        <h4 className="font-bold text-stone-800 text-lg">{b.clientData?.name} <span className="text-sm font-normal text-stone-500">- {b.typeOfConfectionery}</span></h4>
                                        <div className="flex items-center gap-4 mt-1">
                                            <p className="text-amber-600 font-bold text-xl">R$ {(b.totalValue || 0).toFixed(2)}</p>
                                            <p className="text-xs text-stone-400 bg-white px-2 py-1 rounded border">Criado por: {b.createdBy || 'Sistema'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 w-full md:w-auto">
                                        <Button variant="secondary" onClick={() => handleReject(b.id)} className="text-red-600 hover:bg-red-50 hover:text-red-700 flex-1 md:flex-none justify-center">
                                            <XCircle size={16} /> Reprovar
                                        </Button>
                                        <Button onClick={() => handleApprove(b.id)} className="flex-1 md:flex-none justify-center">
                                            <CheckCircle size={16} /> Aprovar
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* 2. CONTEÚDO: REJEITADOS */}
                {activeTab === 'rejected' && (
                    <div className="space-y-4">
                        {rejectedBudgets.length === 0 ? (
                            <div className="text-center py-12 text-stone-400 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                                <p>Nenhum orçamento rejeitado.</p>
                            </div>
                        ) : (
                            rejectedBudgets.map(b => (
                                <div key={b.id} className="flex flex-col md:flex-row justify-between items-center p-4 border border-red-100 rounded-lg bg-red-50/10 hover:shadow-md transition-all gap-4">
                                    <div>
                                        <h4 className="font-bold text-stone-600">{b.clientData?.name}</h4>
                                        <p className="text-stone-500 font-mono text-sm">R$ {(b.totalValue || 0).toFixed(2)}</p>
                                        <span className="text-[10px] font-bold uppercase text-red-500 bg-white border border-red-100 px-2 py-0.5 rounded-full mt-2 inline-block">Rejeitado</span>
                                    </div>
                                    <div className="flex gap-3 w-full md:w-auto">
                                        <button 
                                            onClick={() => handleSoftDelete(b.id)} 
                                            className="px-4 py-2 text-xs font-bold text-stone-400 hover:bg-stone-100 rounded-lg transition-colors flex items-center gap-2 border border-transparent hover:border-stone-200"
                                            title="Mover para Lixeira"
                                        >
                                            <Trash2 size={14} /> Lixeira
                                        </button>
                                        <button 
                                            onClick={() => handleRestore(b.id)} 
                                            className="px-4 py-2 text-sm font-bold bg-white border border-amber-200 text-amber-600 hover:bg-amber-50 rounded-lg transition-all flex items-center gap-2 shadow-sm flex-1 md:flex-none justify-center"
                                        >
                                            <RotateCcw size={16} /> Restaurar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* 3. CONTEÚDO: LIXEIRA */}
                {activeTab === 'deleted' && (
                    <div className="space-y-4">
                        {deletedBudgets.length === 0 ? (
                            <div className="text-center py-12 text-stone-400 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                                <p>Lixeira vazia.</p>
                            </div>
                        ) : (
                            deletedBudgets.map(b => (
                                <div key={b.id} className="flex flex-col md:flex-row justify-between items-center p-4 border border-stone-200 rounded-lg bg-stone-100 opacity-75 hover:opacity-100 transition-all gap-4">
                                    <div>
                                        <h4 className="font-bold text-stone-800 line-through decoration-stone-400">{b.clientData?.name}</h4>
                                        <p className="text-stone-500 font-mono text-sm">R$ {(b.totalValue || 0).toFixed(2)}</p>
                                        <p className="text-xs text-red-500 mt-1">Excluído por: {b.deletedBy || '?'}</p>
                                    </div>
                                    <div className="flex gap-3 w-full md:w-auto">
                                        <button 
                                            onClick={() => handlePermanentDelete(b.id)} 
                                            className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-2"
                                            title="Excluir Permanentemente"
                                        >
                                            <Trash2 size={14} /> Apagar
                                        </button>
                                        <button 
                                            onClick={() => handleRestore(b.id)} 
                                            className="px-4 py-2 text-sm font-bold bg-white border border-stone-300 text-stone-600 hover:text-amber-600 hover:border-amber-600 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                                        >
                                            <RotateCcw size={16} /> Restaurar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};

// 5.5 GESTÃO DE PRODUTOS (ATUALIZADO: Controle Total de Categorias)
const ProductsManager = () => {
  const { userProfile, hasRole } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- ESTADOS DE CATEGORIAS ---
  const [categoriesList, setCategoriesList] = useState([]); // Lista vinda do Banco
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({ id: null, name: '' });
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Estados de Produtos e Custos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [selectedProductForCost, setSelectedProductForCost] = useState(null);
  const [costForm, setCostForm] = useState({ startDate: '', cost: 0, costDisplay: '' });
  const [closingIndex, setClosingIndex] = useState(null);
  const [closingDate, setClosingDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Lista de Referência (Apenas para o botão de "Importar Padrões")
  const SYSTEM_DEFAULTS = [
    "Bolos", "Recheios", "Adicionais", "Doces Tradicionais", 
    "Doces Gourmet", "Caramelados", "Bombons", 
    "Copinhos de Chocolate", "Natal", "Bem-casado"
  ];

  // A lista usada no select agora vem 100% do banco de dados
  const availableCategories = categoriesList.map(c => c.name).sort();

  // Estado para formulário de produto
  const [formData, setFormData] = useState({ category: '', description: '', price: 0, priceDisplay: '' });

  useEffect(() => {
    // Busca Produtos
    const unsubProducts = onSnapshot(getColRef('products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Busca Categorias (Todas agora são "custom" / editáveis)
    const unsubCategories = onSnapshot(getColRef('categories'), (snap) => {
        setCategoriesList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
        unsubProducts();
        unsubCategories();
    };
  }, []);

  // --- HELPER DATA ---
  const formatDateDisplay = (dateString) => {
      if (!dateString) return '-';
      const parts = dateString.split('-');
      if (parts.length !== 3) return dateString;
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
  };

  // --- HANDLERS: GESTÃO DE CATEGORIAS ---
  
  const handleSaveCategory = async (e) => {
      e.preventDefault();
      const nameToSave = catForm.name.trim();
      if (!nameToSave) return;

      // Verifica duplicidade
      const exists = categoriesList.some(c => c.name.toLowerCase() === nameToSave.toLowerCase());
      const isSelf = catForm.id && categoriesList.find(c => c.id === catForm.id)?.name.toLowerCase() === nameToSave.toLowerCase();
      
      if (exists && !isSelf) {
          alert("Esta categoria já existe.");
          return;
      }

      setIsSavingCategory(true);
      try {
          if (catForm.id) {
              await updateDoc(doc(getColRef('categories'), catForm.id), {
                  name: nameToSave,
                  updatedBy: userProfile?.email || 'Sistema',
                  updatedAt: serverTimestamp()
              });
              alert("Categoria atualizada!");
          } else {
              await addDoc(getColRef('categories'), {
                  name: nameToSave,
                  createdBy: userProfile?.email || 'Sistema',
                  createdAt: serverTimestamp()
              });
              alert("Categoria criada!");
          }
          setCatForm({ id: null, name: '' });
      } catch (error) {
          console.error("Erro categoria:", error);
          alert("Erro ao salvar categoria.");
      } finally {
          setIsSavingCategory(false);
      }
  };

  // Função para importar as categorias padrão para o banco (para não começar do zero)
  const handleImportDefaults = async () => {
      if(!confirm("Deseja importar as categorias padrão do sistema para o seu banco de dados?")) return;
      
      setIsSavingCategory(true);
      try {
          const missing = SYSTEM_DEFAULTS.filter(def => 
              !categoriesList.some(c => c.name.toLowerCase() === def.toLowerCase())
          );

          if (missing.length === 0) {
              alert("Todas as categorias padrão já estão cadastradas.");
          } else {
              const promises = missing.map(name => 
                  addDoc(getColRef('categories'), {
                      name: name,
                      createdBy: 'Sistema (Importação)',
                      createdAt: serverTimestamp()
                  })
              );
              await Promise.all(promises);
              alert(`${missing.length} categorias importadas com sucesso!`);
          }
      } catch (error) {
          console.error("Erro importação:", error);
      } finally {
          setIsSavingCategory(false);
      }
  };

  const handleEditCategory = (cat) => {
      setCatForm({ id: cat.id, name: cat.name });
  };

  const handleDeleteCategory = async (id, name) => {
      if (!confirm(`ATENÇÃO: Deseja excluir a categoria "${name}"?\n\nOs produtos desta categoria NÃO serão excluídos, mas ficarão sem categoria na listagem.`)) return;
      try {
          await deleteDoc(doc(getColRef('categories'), id));
      } catch (error) {
          console.error("Erro ao excluir:", error);
          alert("Erro ao excluir categoria.");
      }
  };

  const handleCloseCategoryModal = () => {
      setIsCategoryModalOpen(false);
      setCatForm({ id: null, name: '' });
  };

  // --- HANDLERS PRODUTO E CUSTOS (MANTIDOS IGUAIS) ---
  const handlePriceChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    const floatValue = parseFloat(value) / 100;
    if (isNaN(floatValue)) { setFormData({ ...formData, price: 0, priceDisplay: '' }); return; }
    const formatted = floatValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    setFormData({ ...formData, price: floatValue, priceDisplay: formatted });
  };

  const openNewProductModal = () => {
      setEditingId(null);
      // Se não houver categorias, deixa vazio, senão pega a primeira
      setFormData({ category: availableCategories[0] || '', description: '', price: 0, priceDisplay: '' });
      setIsModalOpen(true);
  };

  const openEditModal = (product) => {
      setEditingId(product.id);
      setFormData({
          category: product.category,
          description: product.description,
          price: product.price,
          priceDisplay: product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      });
      setIsModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.description || formData.price <= 0) { alert("Preencha descrição e valor."); return; }
    if (!formData.category) { alert("Selecione ou crie uma categoria primeiro."); return; }
    
    setIsSaving(true);
    try {
      const payload = {
          category: formData.category,
          description: formData.description,
          price: formData.price,
          updatedBy: userProfile?.email || 'Sistema',
          updatedAt: serverTimestamp()
      };
      if (editingId) {
          await updateDoc(doc(getColRef('products'), editingId), payload);
          alert("Produto atualizado!");
      } else {
          await addDoc(getColRef('products'), { ...payload, createdAt: serverTimestamp() });
      }
      setIsModalOpen(false);
    } catch (error) { console.error(error); alert("Erro ao salvar: " + error.message); } finally { setIsSaving(false); }
  };

  const handleDelete = async (id) => {
      if (!hasRole(['admin', 'manager'])) return alert("Acesso negado.");
      if (confirm("Tem certeza que deseja excluir este produto?")) { await deleteDoc(doc(getColRef('products'), id)); }
  };

  const handleOpenCostModal = (product) => {
      setSelectedProductForCost(product);
      setCostForm({ startDate: '', cost: 0, costDisplay: '' });
      setClosingIndex(null); setIsCostModalOpen(true);
  };

  const handleCostValueChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    const floatValue = parseFloat(value) / 100;
    if (isNaN(floatValue)) { setCostForm({ ...costForm, cost: 0, costDisplay: '' }); return; }
    const formatted = floatValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    setCostForm({ ...costForm, cost: floatValue, costDisplay: formatted });
  };

  const handleAddCostEntry = async (e) => {
      e.preventDefault();
      if (!costForm.startDate || costForm.cost <= 0) { alert("Preencha Data Inicial e Custo."); return; }
      
      try {
          const updatedHistory = [...(selectedProductForCost.costHistory || [])];
          
          // LÓGICA: Encontrar o custo anterior "vigente" (sem endDate) e marcá-lo como inativo
          const vigoroIndex = updatedHistory.findIndex(h => !h.endDate);
          if (vigoroIndex !== -1) {
              // Calcula a data anterior à nova data inicial
              const [year, month, day] = costForm.startDate.split('-').map(Number);
              const previousDate = new Date(year, month - 1, day);
              previousDate.setDate(previousDate.getDate() - 1);
              const previousDateStr = previousDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
              
              updatedHistory[vigoroIndex] = { ...updatedHistory[vigoroIndex], endDate: previousDateStr };
          }
          
          // Adiciona o novo custo
          const newEntry = { id: Date.now().toString(), startDate: costForm.startDate, endDate: null, cost: costForm.cost, addedAt: new Date().toISOString(), addedBy: userProfile?.email || 'Sistema' };
          updatedHistory.push(newEntry);
          
          await updateDoc(doc(getColRef('products'), selectedProductForCost.id), { costHistory: updatedHistory });
          setSelectedProductForCost({ ...selectedProductForCost, costHistory: updatedHistory });
          setCostForm({ startDate: '', cost: 0, costDisplay: '' });
      } catch (error) { console.error(error); alert("Erro ao salvar custo."); }
  };

  const handleSaveEndDate = async (entryIdx) => {
      if (!closingDate) { alert("Selecione data."); return; }
      try {
          const updatedHistory = [...selectedProductForCost.costHistory];
          updatedHistory[entryIdx] = { ...updatedHistory[entryIdx], endDate: closingDate };
          await updateDoc(doc(getColRef('products'), selectedProductForCost.id), { costHistory: updatedHistory });
          setSelectedProductForCost({ ...selectedProductForCost, costHistory: updatedHistory });
          setClosingIndex(null); setClosingDate('');
      } catch (error) { console.error(error); }
  };

  const handleDeleteCostEntry = async (entryIdx) => {
      if (!confirm("Remover registro?")) return;
      try {
          const updatedHistory = [...selectedProductForCost.costHistory];
          updatedHistory.splice(entryIdx, 1);
          await updateDoc(doc(getColRef('products'), selectedProductForCost.id), { costHistory: updatedHistory });
          setSelectedProductForCost({ ...selectedProductForCost, costHistory: updatedHistory });
      } catch (error) { console.error(error); }
  };

  const filteredProducts = products.filter(p => 
    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const canManage = hasRole(['admin', 'manager']);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-serif font-bold text-stone-800">Catálogo de Produtos</h2>
        <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 text-stone-400" size={18} />
                <input type="text" placeholder="Buscar produto..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            {canManage && (
                <>
                    <Button onClick={() => setIsCategoryModalOpen(true)} variant="secondary" className="whitespace-nowrap bg-stone-100 border border-stone-200"><Tag size={18} /> Categorias</Button>
                    <Button onClick={openNewProductModal} className="whitespace-nowrap"><Plus size={18} /> Novo Produto</Button>
                </>
            )}
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-white rounded-xl shadow border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="p-4 w-40 text-stone-600 font-semibold text-sm">Item (Categoria)</th>
                  <th className="p-4 text-stone-600 font-semibold text-sm">Descrição</th>
                  <th className="p-4 text-stone-600 font-semibold text-sm w-40">Valor Venda</th>
                  <th className="p-4 text-stone-600 font-semibold text-sm text-right w-40">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProducts.map(prod => (
                  <tr key={prod.id} className="hover:bg-amber-50/30">
                    <td className="p-4"><span className="px-2 py-1 bg-stone-100 text-stone-600 rounded text-xs font-bold uppercase tracking-wider border border-stone-200 whitespace-nowrap">{prod.category}</span></td>
                    <td className="p-4 font-medium text-stone-800">{prod.description}</td>
                    <td className="p-4 font-mono text-stone-600">{prod.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                          {canManage ? (
                              <>
                                <button onClick={() => handleOpenCostModal(prod)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200" title="Gerir Custos"><DollarSign size={18} /></button>
                                <button onClick={() => openEditModal(prod)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Edit2 size={18} /></button>
                                <button onClick={() => handleDelete(prod.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                              </>
                          ) : <Lock size={16} className="text-stone-300 mx-auto" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
        {filteredProducts.length === 0 && <div className="p-8 text-center text-stone-400">Nenhum produto encontrado.</div>}
      </div>

      {/* MODAL 1: PRODUTO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-serif font-bold mb-6 text-stone-800 border-b pb-2">{editingId ? 'Editar Produto' : 'Novo Produto'}</h3>
            <form onSubmit={handleSaveProduct}>
              <div className="mb-4">
                  <label className="block text-stone-600 text-sm font-semibold mb-1">Item (Categoria)</label>
                  {availableCategories.length > 0 ? (
                      <select className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                          {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                  ) : (
                      <div className="p-3 bg-red-50 border border-red-100 rounded text-xs text-red-600">Nenhuma categoria cadastrada. Vá em "Categorias" primeiro.</div>
                  )}
              </div>
              <Input label="Descrição" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ex: Bolo de Cenoura" required />
              <div className="mb-4">
                  <label className="block text-stone-600 text-sm font-semibold mb-1">Valor Venda (R$)</label>
                  <input type="text" className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none font-mono" value={formData.priceDisplay} onChange={handlePriceChange} placeholder="R$ 0,00" required />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <Button variant="secondary" onClick={(e) => { e.preventDefault(); setIsModalOpen(false); }}>Cancelar</Button>
                <Button type="submit" disabled={isSaving || availableCategories.length === 0}>{isSaving ? 'Salvando...' : 'Salvar Produto'}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: CUSTOS (MANTIDO) */}
      {isCostModalOpen && selectedProductForCost && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                  <div className="border-b pb-4 mb-4 flex justify-between items-start">
                      <div><h3 className="text-xl font-serif font-bold text-stone-800">Histórico de Custos</h3><p className="text-stone-500 text-sm font-medium">{selectedProductForCost.description}</p></div>
                      <button onClick={() => setIsCostModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X size={24} /></button>
                  </div>
                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-6 shrink-0">
                      <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Adicionar Novo Custo Vigente</h4>
                      <div className="flex gap-3 mb-3">
                          <div className="w-1/2"><label className="text-[10px] font-bold text-stone-400 uppercase">Data Inicial *</label><input type="date" className="w-full px-3 py-2 rounded border border-stone-300 text-sm outline-none focus:border-emerald-500" value={costForm.startDate} onChange={e => setCostForm({...costForm, startDate: e.target.value})} /></div>
                          <div className="w-1/2"><label className="text-[10px] font-bold text-stone-400 uppercase">Custo Unitário (R$) *</label><input type="text" className="w-full px-3 py-2 rounded border border-stone-300 text-sm outline-none focus:border-emerald-500 font-mono font-bold text-stone-700" placeholder="R$ 0,00" value={costForm.costDisplay} onChange={handleCostValueChange} /></div>
                      </div>
                      <Button onClick={handleAddCostEntry} className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"><Plus size={16} /> Adicionar Custo</Button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar border-t border-stone-100 pt-2">
                      <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 sticky top-0 bg-white py-2">Registros Anteriores</h4>
                      {selectedProductForCost.costHistory && selectedProductForCost.costHistory.length > 0 ? (
                          <table className="w-full text-sm text-left"><thead className="text-stone-400 text-xs font-bold bg-stone-50 uppercase"><tr><th className="p-2">Início</th><th className="p-2">Fim</th><th className="p-2 text-right">Custo</th><th className="p-2 w-8"></th></tr></thead>
                              <tbody className="divide-y divide-stone-100">
                                  {[...selectedProductForCost.costHistory].sort((a, b) => (a.startDate < b.startDate ? 1 : -1)).map((entry, idx) => (
                                      <tr key={idx} className="hover:bg-stone-50">
                                          <td className="p-2 text-stone-700 font-mono text-xs">{formatDateDisplay(entry.startDate)}</td>
                                          <td className="p-2 text-stone-500 font-mono text-xs">{entry.endDate ? formatDateDisplay(entry.endDate) : (closingIndex === idx ? (<div className="flex items-center gap-1 animate-in fade-in"><input type="date" className="w-24 text-[10px] p-1 border border-stone-300 rounded outline-none" value={closingDate} onChange={e => setClosingDate(e.target.value)} /><button onClick={() => handleSaveEndDate(idx)} className="text-green-600 hover:bg-green-100 p-1 rounded"><CheckCircle size={14}/></button><button onClick={() => setClosingIndex(null)} className="text-red-400 hover:bg-red-50 p-1 rounded"><X size={14}/></button></div>) : (<div className="flex items-center gap-2">{entry.endDate ? (<span className="text-stone-500 font-bold text-[10px] bg-stone-100 px-1 rounded border border-stone-200 cursor-default">INATIVO</span>) : (<span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-1 rounded border border-emerald-100 cursor-default">VIGENTE</span>)}<button onClick={() => { setClosingIndex(idx); setClosingDate(''); }} className="text-stone-400 hover:text-amber-600 hover:bg-amber-50 p-1 rounded transition-colors"><Calendar size={14} /></button></div>))}</td>
                                          <td className="p-2 text-right font-bold text-stone-800">{entry.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                          <td className="p-2 text-right">{closingIndex !== idx && (<button onClick={() => handleDeleteCostEntry(idx)} className="text-stone-300 hover:text-red-500"><X size={14}/></button>)}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (<div className="text-center py-8 text-stone-400 italic text-sm bg-stone-50 rounded border border-dashed">Nenhum histórico de custo cadastrado.</div>)}
                  </div>
              </Card>
          </div>
      )}

      {/* MODAL 3: GERENCIAR CATEGORIAS (COMPLETO) */}
      {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-md shadow-xl animate-in fade-in zoom-in duration-200 max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4 border-b pb-2 shrink-0">
                      <h3 className="text-lg font-bold text-stone-800">Gerenciar Categorias</h3>
                      <button onClick={handleCloseCategoryModal} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
                  </div>
                  
                  {/* FORMULÁRIO */}
                  <div className="flex gap-2 mb-4 shrink-0">
                      <div className="flex-1">
                          <input 
                              type="text"
                              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                              placeholder={catForm.id ? "Editando..." : "Nova Categoria..."} 
                              value={catForm.name} 
                              onChange={(e) => setCatForm({...catForm, name: e.target.value})}
                              autoFocus
                          />
                      </div>
                      <Button onClick={handleSaveCategory} disabled={!catForm.name.trim() || isSavingCategory}>
                          {isSavingCategory ? '...' : (catForm.id ? <Save size={18}/> : <Plus size={18}/>)}
                      </Button>
                      {catForm.id && (
                          <Button variant="secondary" onClick={() => setCatForm({id: null, name: ''})} title="Cancelar Edição"><X size={18}/></Button>
                      )}
                  </div>

                  {/* LISTA DE CATEGORIAS */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar border-t border-stone-100 pt-2">
                      <div className="space-y-1">
                          {categoriesList.length > 0 ? (
                              categoriesList.sort((a,b) => a.name.localeCompare(b.name)).map(cat => (
                                  <div key={cat.id} className={`flex justify-between items-center p-2 rounded border transition-colors ${catForm.id === cat.id ? 'bg-amber-50 border-amber-300' : 'bg-white border-stone-100 hover:border-amber-200'}`}>
                                      <span className="font-medium text-stone-700 text-sm">{cat.name}</span>
                                      <div className="flex gap-1">
                                          <button onClick={() => handleEditCategory(cat)} className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Editar"><Edit2 size={14}/></button>
                                          <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 size={14}/></button>
                                      </div>
                                  </div>
                              ))
                          ) : (
                              <div className="text-center py-6">
                                  <p className="text-stone-400 text-xs italic mb-4">Nenhuma categoria cadastrada.</p>
                                  <Button onClick={handleImportDefaults} variant="outline" className="w-full text-xs justify-center border-dashed">
                                      <Download size={14} /> Importar Padrões (Bolos, Doces...)
                                  </Button>
                              </div>
                          )}
                      </div>
                  </div>
                  {/* Botão de importar visível sempre caso falte alguma padrão */}
                  {categoriesList.length > 0 && categoriesList.length < SYSTEM_DEFAULTS.length && (
                      <div className="mt-4 pt-2 border-t border-stone-100 text-center">
                          <button onClick={handleImportDefaults} className="text-[10px] text-amber-600 hover:underline font-bold uppercase tracking-wider">
                              Restaurar Categorias Padrão
                          </button>
                      </div>
                  )}
              </Card>
          </div>
      )}
    </div>
  );
};

// --- 6. LANÇAMENTOS (Despesas e Matérias-Primas) ---
const LaunchesManager = () => {
  const { userProfile } = useContext(AuthContext);
  const [launches, setLaunches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Função para formatar valores em moeda
  const formatCurrency = (value) => {
    if (!value) return '';
    const num = parseFloat(value.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (isNaN(num)) return '';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Função para remover formatação de moeda
  const unformatCurrency = (value) => {
    if (!value) return '';
    return value.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
  };
  
  // Estado para rastrear o valor sendo editado no input de moeda
  const [unitValueDisplay, setUnitValueDisplay] = useState('');
  
  // Filtros
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const years = [2025, 2026, 2027];
  const launchTypes = ["Nota Fiscal", "Movimentação Financeira", "Pagamentos", "Outros"];

  const [formData, setFormData] = useState({
    date: '',
    type: '',
    supplier: '',
    description: '',
    quantity: '',
    unitValue: '',
    totalValue: '',
    observations: ''
  });

  // Carrega lançamentos
  useEffect(() => {
    const q = query(getColRef('launches'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLaunches(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const openNewLaunchModal = () => {
    setEditingId(null);
    setFormData({ date: '', type: '', supplier: '', description: '', quantity: '', unitValue: '', totalValue: '', observations: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (launch) => {
    setEditingId(launch.id);
    setFormData({
      date: launch.date || '',
      type: launch.type || '',
      supplier: launch.supplier || '',
      description: launch.description || '',
      quantity: launch.quantity || '',
      unitValue: launch.unitValue || '',
      totalValue: launch.totalValue || '',
      observations: launch.observations || ''
    });
    setUnitValueDisplay(launch.unitValue ? `R$ ${formatCurrency(launch.unitValue)}` : '');
    setIsModalOpen(true);
  };

  const handleSaveLaunch = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const launchPayload = {
        date: formData.date,
        type: formData.type,
        supplier: formData.supplier,
        description: formData.description,
        quantity: formData.quantity ? parseFloat(formData.quantity) : 0,
        unitValue: formData.unitValue ? parseFloat(formData.unitValue) : 0,
        totalValue: formData.totalValue ? parseFloat(formData.totalValue) : 0,
        observations: formData.observations,
        updatedBy: userProfile?.email || 'Sistema',
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(getColRef('launches'), editingId), launchPayload);
        alert("Lançamento atualizado com sucesso!");
      } else {
        await addDoc(getColRef('launches'), { ...launchPayload, createdAt: serverTimestamp() });
        alert("Lançamento cadastrado com sucesso!");
      }
      setIsModalOpen(false);
      setUnitValueDisplay('');
      setFormData({
        date: '',
        type: '',
        supplier: '',
        description: '',
        quantity: '',
        unitValue: '',
        totalValue: '',
        observations: ''
      });

    } catch (error) {
      console.error("Erro ao salvar lançamento:", error);
      alert("Erro ao salvar dados.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir este lançamento?")) {
      await deleteDoc(doc(getColRef('launches'), id));
    }
  };

  // Filtra lançamentos por período
  const filteredLaunches = launches.filter(l => {
    const launchDate = new Date(l.date);
    const yearMatch = launchDate.getFullYear() === parseInt(selectedYear);
    const monthMatch = launchDate.getMonth() === parseInt(selectedMonth);
    const searchMatch = 
      (l.supplier && l.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.description && l.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.type && l.type.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return yearMatch && monthMatch && searchMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-serif font-bold text-stone-800">Lançamentos</h2>
        
        <div className="flex gap-2 w-full md:w-auto flex-wrap items-center">
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
          >
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <Button onClick={openNewLaunchModal}><Plus size={18} /> Novo Lançamento</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="p-4 text-stone-600 font-semibold text-sm">Data</th>
                <th className="p-4 text-stone-600 font-semibold text-sm">Tipo</th>
                <th className="p-4 text-stone-600 font-semibold text-sm">Fornecedor</th>
                <th className="p-4 text-stone-600 font-semibold text-sm">Descrição</th>
                <th className="p-4 text-stone-600 font-semibold text-sm text-right">Quantidade</th>
                <th className="p-4 text-stone-600 font-semibold text-sm text-right">Valor Unit.</th>
                <th className="p-4 text-stone-600 font-semibold text-sm text-right">Valor Total</th>
                <th className="p-4 text-stone-600 font-semibold text-sm">Observações</th>
                <th className="p-4 text-stone-600 font-semibold text-sm w-32 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredLaunches.map(launch => (
                <tr key={launch.id} className="hover:bg-amber-50/30">
                  <td className="p-4 font-mono text-sm text-stone-700">{launch.date ? new Date(launch.date).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="p-4 text-sm text-stone-600">{launch.type || '-'}</td>
                  <td className="p-4 font-bold text-stone-800">{launch.supplier || '-'}</td>
                  <td className="p-4 text-sm text-stone-600">{launch.description || '-'}</td>
                  <td className="p-4 text-sm text-right text-stone-600">{launch.quantity || '-'}</td>
                  <td className="p-4 text-sm text-right font-bold text-stone-700">{launch.unitValue ? `R$ ${parseFloat(launch.unitValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                  <td className="p-4 text-sm text-right font-bold text-amber-600">{launch.totalValue ? `R$ ${parseFloat(launch.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                  <td className="p-4 text-sm text-stone-600 max-w-xs truncate">{launch.observations || '-'}</td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEditModal(launch)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(launch.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLaunches.length === 0 && <div className="p-8 text-center text-stone-400">Nenhum lançamento encontrado.</div>}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b pb-2">
              <h3 className="text-xl font-serif font-bold text-stone-800">{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
              <button onClick={() => {
                setIsModalOpen(false);
                setUnitValueDisplay('');
                setFormData({
                  date: '',
                  type: '',
                  supplier: '',
                  description: '',
                  quantity: '',
                  unitValue: '',
                  totalValue: '',
                  observations: ''
                });
              }} className="text-stone-400 hover:text-stone-600"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSaveLaunch} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-stone-600">Data</label>
                  <input 
                    type="date" 
                    value={formData.date} 
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-stone-600">Tipo de Lançamento</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  >
                    <option value="">Selecione um tipo...</option>
                    {launchTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>

                <Input 
                  label="Fornecedor" 
                  value={formData.supplier} 
                  onChange={e => setFormData({...formData, supplier: e.target.value})}
                  placeholder="Nome do fornecedor"
                />

                <Input 
                  label="Descrição da Matéria" 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Descrição do produto"
                />

                <Input 
                  label="Quantidade" 
                  type="number"
                  step="0.01"
                  value={formData.quantity} 
                  onChange={e => {
                    const quantity = e.target.value;
                    const unitValue = formData.unitValue;
                    const totalValue = quantity && unitValue ? (parseFloat(quantity) * parseFloat(unitValue)).toFixed(2) : '';
                    setFormData({...formData, quantity, totalValue});
                  }}
                  placeholder="0"
                />

                <Input 
                  label="Valor Unitário" 
                  type="text"
                  value={unitValueDisplay} 
                  onChange={e => {
                    const input = e.target.value;
                    setUnitValueDisplay(input);
                    
                    const unitValue = input.replace(/[^\d.,]/g, '').replace(',', '.');
                    const quantity = formData.quantity;
                    const totalValue = quantity && unitValue ? (parseFloat(quantity) * parseFloat(unitValue)).toFixed(2) : '';
                    setFormData({...formData, unitValue, totalValue});
                  }}
                  onBlur={() => {
                    if (unitValueDisplay) {
                      const formatted = formatCurrency(unitValueDisplay);
                      setUnitValueDisplay(`R$ ${formatted}`);
                    }
                  }}
                  placeholder="R$ 0,00"
                />

                <Input 
                  label="Valor Total" 
                  type="text"
                  value={formData.totalValue ? `R$ ${formatCurrency(formData.totalValue)}` : ''}
                  disabled
                  placeholder="R$ 0,00"
                  className="col-span-2 bg-stone-100"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-stone-600">Observações</label>
                <textarea 
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm" 
                  rows="3" 
                  value={formData.observations} 
                  onChange={e => setFormData({...formData, observations: e.target.value})}
                  placeholder="Digite observações adicionais..."
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100">
                <Button variant="secondary" onClick={(e) => { 
                  e.preventDefault(); 
                  setIsModalOpen(false);
                  setUnitValueDisplay('');
                  setFormData({
                    date: '',
                    type: '',
                    supplier: '',
                    description: '',
                    quantity: '',
                    unitValue: '',
                    totalValue: '',
                    observations: ''
                  });
                }} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar Lançamento'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

// --- 7. DASHBOARD FINANCEIRO (CORRIGIDO: Relatório de Pagamentos e Soma) ---
const FinancialDashboard = () => {
    const { userProfile } = useContext(AuthContext);
    const [data, setData] = useState([]);
    const [products, setProducts] = useState([]); 
    
    // Filtros Principais
    const [periodType, setPeriodType] = useState('month');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedPeriodValue, setSelectedPeriodValue] = useState(new Date().getMonth());

    // Estados dos Modais
    const [showRevenueDetails, setShowRevenueDetails] = useState(false);
    const [showItemDetails, setShowItemDetails] = useState(false);
    
    // --- ESTADOS DO RELATÓRIO DE PAGAMENTOS ---
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportDates, setReportDates] = useState({ start: '', end: '' });
    const [reportResult, setReportResult] = useState(null);

    // Filtro do Modal de Produtos
    const [itemCategoryFilter, setItemCategoryFilter] = useState('Todas');
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const years = [2025, 2026, 2027];
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const quarters = ["1º Trimestre (Jan-Mar)", "2º Trimestre (Abr-Jun)", "3º Trimestre (Jul-Set)", "4º Trimestre (Out-Dez)"];
    const semesters = ["1º Semestre (Jan-Jun)", "2º Semestre (Jul-Dez)"];

    const REPORT_CATEGORIES = [
        "Casamento", "Aniversário", "Primeira Eucaristia/ Crisma", 
        "Natal", "Páscoa", "Confraternização", "Batizado", "Eventos em Geral"
    ];

    // 1. Busca Orçamentos e Produtos
    useEffect(() => {
        const qBudgets = query(getColRef('budgets'), where('status', '==', 'approved'));
        const unsubBudgets = onSnapshot(qBudgets, (snapshot) => {
            const rawData = snapshot.docs.map(d => {
                const b = d.data();
                const parts = b.eventDate ? b.eventDate.split('-') : null;
                const date = parts ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
                
                let createdAtDate = new Date();
                if (b.createdAt && b.createdAt.seconds) {
                    createdAtDate = new Date(b.createdAt.seconds * 1000);
                } else if (b.createdAt) {
                    createdAtDate = new Date(b.createdAt); 
                }

                let category = b.typeOfConfectionery || 'Eventos em Geral';
                if (category === 'Primeira Eucaristia/Crisma') category = 'Primeira Eucaristia/ Crisma';

                // GARANTIA DE NÚMEROS
                const val = parseFloat(b.totalValue);
                const entryVal = parseFloat(b.entryValue);

                return {
                    id: d.id,
                    date: date,
                    createdAt: createdAtDate,
                    totalValue: isNaN(val) ? 0 : val,
                    category: category,
                    client: b.clientData?.name || 'Cliente',
                    paymentMethod: b.paymentMethod || 'Não informado',
                    paymentStatus: b.paymentStatus || 'Pendente',
                    
                    // Datas
                    paymentDate: b.paymentDate || null, 
                    remainingPaymentDate: b.remainingPaymentDate || null, 

                    installments: b.installments || 1,
                    entryValue: isNaN(entryVal) ? 0 : entryVal,
                    entryMethod: b.entryMethod || 'Pix',
                    items: b.items || [] 
                };
            });
            setData(rawData);
        });

        const qProducts = query(getColRef('products'));
        const unsubProducts = onSnapshot(qProducts, (snapshot) => {
            setProducts(snapshot.docs.map(d => d.data()));
        });

        return () => { unsubBudgets(); unsubProducts(); };
    }, []);

// --- LÓGICA DO RELATÓRIO DE PAGAMENTOS (CORRIGIDA) ---
    const generatePaymentReport = () => {
        if (!reportDates.start || !reportDates.end) {
            alert("Selecione a data inicial e final.");
            return;
        }

        // Normalizamos as datas de busca para comparação de strings YYYY-MM-DD
        // Isso evita problemas com fusos horários de objetos Date
        const startDateStr = reportDates.start;
        const endDateStr = reportDates.end;

        // Estrutura: { '2026-01-10': { count: 0, total: 0, methods: { 'Pix': 100, 'Dinheiro': 50 } } }
        const groupedData = {};

        // Função auxiliar robusta para somar
        const addData = (dateKey, amountRaw, method) => {
            const amount = parseFloat(amountRaw);
            
            // Só conta se o valor for válido e maior que zero
            if (isNaN(amount) || amount <= 0.001) return;

            if (!groupedData[dateKey]) {
                groupedData[dateKey] = { count: 0, total: 0, methods: {} };
            }
            
            // Incrementa contadores
            groupedData[dateKey].count += 1;
            groupedData[dateKey].total += amount;
            
            const methodKey = method || 'Indefinido';
            groupedData[dateKey].methods[methodKey] = (groupedData[dateKey].methods[methodKey] || 0) + amount;
        };

        data.forEach(order => {
            // 1. Verificar Pagamento Principal (Entrada ou Total Integral)
            // Comparamos as strings de data diretamente (YYYY-MM-DD)
            if (order.paymentDate) {
                if (order.paymentDate >= startDateStr && order.paymentDate <= endDateStr) {
                    const dateKey = order.paymentDate;
                    
                    // Se houver valor de ENTRADA (> 0), soma a entrada.
                    // Se NÃO houver entrada, mas o status for 'Pago', assume-se pagamento INTEGRAL.
                    if (order.entryValue > 0) {
                        addData(dateKey, order.entryValue, order.entryMethod);
                    } else if (order.paymentStatus === 'Pago') {
                        addData(dateKey, order.totalValue, order.paymentMethod);
                    }
                }
            }

            // 2. Verificar Pagamento Restante (Segunda parte do pagamento)
            if (order.remainingPaymentDate) {
                if (order.remainingPaymentDate >= startDateStr && order.remainingPaymentDate <= endDateStr) {
                    // O valor restante é o Total menos a Entrada (se houver)
                    const remainingAmount = order.totalValue - (order.entryValue || 0);
                    
                    if (remainingAmount > 0) {
                        // O restante usa o método principal cadastrado no pedido
                        addData(order.remainingPaymentDate, remainingAmount, order.paymentMethod);
                    }
                }
            }
        });

        const result = Object.entries(groupedData)
            .map(([date, info]) => ({ date, ...info }))
            .sort((a, b) => a.date.localeCompare(b.date));

        if (result.length === 0) {
            alert("Nenhum registro encontrado para este período.");
        }

        setReportResult(result);
    };

    const formatDateBr = (dateString) => {
        const [y, m, d] = dateString.split('-');
        return `${d}/${m}/${y}`;
    };

    // --- FUNÇÃO DE CUSTO HISTÓRICO (Mantida) ---
    const getProductCostAtDate = (productDesc, dateToCheck) => {
        const product = products.find(p => p.description === productDesc);
        if (!product || !product.costHistory || product.costHistory.length === 0) return 0;
        const entry = product.costHistory.find(h => {
            const [startYear, startMonth, startDay] = h.startDate.split('-').map(Number);
            const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0); 
            let endDate = null;
            if (h.endDate) {
                const [endYear, endMonth, endDay] = h.endDate.split('-').map(Number);
                endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59); 
            }
            return endDate ? (dateToCheck >= startDate && dateToCheck <= endDate) : (dateToCheck >= startDate);
        });
        return entry ? entry.cost : 0;
    };

    // --- FILTRAGEM (Mantida) ---
    const getFilteredData = (year, pType, pValue) => {
        return data.filter(item => {
            const itemYear = item.date.getFullYear();
            const itemMonth = item.date.getMonth();
            if (itemYear !== parseInt(year)) return false;
            if (pType === 'year') return true;
            if (pType === 'month') return itemMonth === parseInt(pValue);
            if (pType === 'quarter') return Math.floor(itemMonth / 3) === parseInt(pValue);
            if (pType === 'semester') return Math.floor(itemMonth / 6) === parseInt(pValue);
            return false;
        });
    };

    const currentData = getFilteredData(selectedYear, periodType, selectedPeriodValue);
    
    // Comparativo
    let prevYear = selectedYear;
    let prevValue = selectedPeriodValue - 1;
    if (prevValue < 0) {
        prevYear = selectedYear - 1;
        if (periodType === 'month') prevValue = 11;
        if (periodType === 'quarter') prevValue = 3;
        if (periodType === 'semester') prevValue = 1;
        if (periodType === 'year') prevValue = 0;
    }
    const previousData = getFilteredData(prevYear, periodType, periodType === 'year' ? 0 : prevValue);

    // --- CÁLCULOS GERAIS (Mantidos) ---
    const calculateMetrics = (dataset) => {
        const totalRev = dataset.reduce((acc, curr) => acc + curr.totalValue, 0);
        const totalCount = dataset.length;
        
        let totalCost = 0;
        dataset.forEach(order => {
            const orderDate = order.createdAt;
            order.items.forEach(item => {
                const qty = parseFloat(item.qty) || 0;
                const unitCost = getProductCostAtDate(item.desc, orderDate);
                totalCost += (qty * unitCost);
            });
        });

        const totalResult = totalRev - totalCost;

        const byCat = {};
        const revByCat = {};
        REPORT_CATEGORIES.forEach(t => { byCat[t] = 0; revByCat[t] = 0; });
        dataset.forEach(d => {
            const cat = REPORT_CATEGORIES.includes(d.category) ? d.category : 'Eventos em Geral';
            byCat[cat] = (byCat[cat] || 0) + 1;
            revByCat[cat] = (revByCat[cat] || 0) + d.totalValue;
        });

        return { totalRev, totalCount, totalCost, totalResult, byCat, revByCat };
    };

    const metricsCurrent = calculateMetrics(currentData);
    const metricsPrev = calculateMetrics(previousData);

    const currentMargin = metricsCurrent.totalRev > 0 ? (metricsCurrent.totalResult / metricsCurrent.totalRev) * 100 : 0;
    const growthRev = metricsPrev.totalRev === 0 ? 100 : ((metricsCurrent.totalRev - metricsPrev.totalRev) / metricsPrev.totalRev) * 100;
    const growthCount = metricsPrev.totalCount === 0 ? 100 : ((metricsCurrent.totalCount - metricsPrev.totalCount) / metricsPrev.totalCount) * 100;
    const growthResult = metricsPrev.totalResult === 0 ? 100 : ((metricsCurrent.totalResult - metricsPrev.totalResult) / metricsPrev.totalResult) * 100;

    // --- DADOS PARA O GRÁFICO (Mantidos) ---
    const annualStats = Array.from({ length: 12 }, (_, i) => {
        const monthData = data.filter(d => d.date.getFullYear() === parseInt(selectedYear) && d.date.getMonth() === i);
        const rev = monthData.reduce((acc, curr) => acc + curr.totalValue, 0);
        let cost = 0;
        monthData.forEach(order => {
            order.items.forEach(item => {
                const qty = parseFloat(item.qty) || 0;
                const unitCost = getProductCostAtDate(item.desc, order.createdAt);
                cost += (qty * unitCost);
            });
        });
        return { rev, cost, res: rev - cost };
    });

    const rawMax = Math.max(...annualStats.map(s => Math.max(s.rev, s.cost)), 1);
    const maxGraphVal = rawMax * 1.15; 
    const polylinePoints = annualStats.map((stat, index) => {
        const x = (index + 0.5) * (100 / 12);
        const displayRes = Math.max(0, stat.res); 
        const y = 100 - ((displayRes / maxGraphVal) * 100);
        return `${x},${y}`;
    }).join(' ');

    // --- CÁLCULO DETALHADO DE ITENS (Mantido) ---
    const calculateItemStats = () => {
        const aggregator = {};
        currentData.forEach(order => {
            const orderDate = order.createdAt;
            order.items.forEach(item => {
                const key = `${item.category}-${item.desc}`;
                if (!aggregator[key]) aggregator[key] = { category: item.category || 'Outros', desc: item.desc || 'Item sem nome', qty: 0, totalVal: 0, totalCost: 0 };
                const qty = parseFloat(item.qty) || 0;
                let itemTotal = parseFloat(item.val);
                if (isNaN(itemTotal)) itemTotal = (parseFloat(item.unitPrice) || 0) * qty;
                aggregator[key].totalVal += (itemTotal - (parseFloat(item.discount) || 0));
                aggregator[key].qty += qty;
                const unitCost = getProductCostAtDate(item.desc, orderDate);
                aggregator[key].totalCost += (unitCost * qty);
            });
        });
        return Object.values(aggregator).sort((a, b) => b.totalVal - a.totalVal);
    };

    const itemStats = calculateItemStats();
    const uniqueItemCategories = ['Todas', ...new Set(itemStats.map(i => i.category))].sort();
    const filteredItemStats = itemCategoryFilter === 'Todas' ? itemStats : itemStats.filter(i => i.category === itemCategoryFilter);
    const filteredItemTotals = filteredItemStats.reduce((acc, curr) => ({ revenue: acc.revenue + curr.totalVal, cost: acc.cost + curr.totalCost }), { revenue: 0, cost: 0 });

    const paymentStats = currentData.reduce((acc, curr) => {
        if (curr.entryValue > 0) {
            const eMethod = curr.entryMethod || 'Pix';
            if (!acc[eMethod]) acc[eMethod] = { count: 0, total: 0 };
            acc[eMethod].total += curr.entryValue;
        }
        const mainMethod = curr.paymentMethod || 'Não Definido';
        const remainingValue = curr.totalValue - (curr.entryValue || 0);
        if (remainingValue > 0) {
            if (!acc[mainMethod]) acc[mainMethod] = { count: 0, total: 0 };
            acc[mainMethod].total += remainingValue;
            acc[mainMethod].count += 1;
        }
        return acc;
    }, {});

    const pendingPayments = currentData.filter(d => {
        if (d.paymentStatus === 'Pendente') return true;
        if (d.paymentStatus === 'Parcial') {
            const method = d.paymentMethod || '';
            if (method.includes('Cartão') || method.includes('Débito')) return false; 
            return true;
        }
        return false;
    });
    
    const totalPendingValue = pendingPayments.reduce((acc, curr) => {
        const paid = curr.entryValue || 0;
        return acc + (curr.totalValue - paid);
    }, 0);

    const installmentPayments = currentData.filter(d => d.paymentMethod === 'Cartão Crédito Parcelado');

    const StatCard = ({ title, value, growth, margin, isMoney, onClick, clickable, variant = 'default' }) => {
        const variants = {
            default: "bg-white border-stone-100 hover:border-amber-200",
            cost: "bg-white border-stone-100 hover:border-red-200",
            profit: "bg-white border-stone-100 hover:border-emerald-200"
        };
        const valueColors = { default: "text-stone-800", cost: "text-red-600", profit: "text-emerald-600" };
        const iconColors = { default: "bg-amber-50 text-amber-600", cost: "bg-red-50 text-red-600", profit: "bg-emerald-50 text-emerald-600" };

        return (
            <div onClick={onClick} className={`${variants[variant]} p-6 rounded-2xl shadow-sm border flex flex-col justify-between transition-all duration-300 ${clickable ? 'cursor-pointer hover:shadow-lg group' : ''}`}>
                <div>
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">{title}</p>
                        <div className={`p-2 rounded-lg ${iconColors[variant]}`}>
                            {variant === 'cost' ? <ArrowDownRight size={16}/> : (variant === 'profit' ? <TrendingUp size={16}/> : <DollarSign size={16}/>)}
                        </div>
                    </div>
                    <h3 className={`text-3xl font-serif font-bold ${valueColors[variant]}`}>
                        {isMoney ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : value}
                    </h3>
                    {margin !== undefined && (
                        <p className="text-xs font-medium mt-1 text-stone-400">
                            Margem: <span className={margin >= 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{margin.toFixed(1)}%</span>
                        </p>
                    )}
                </div>
                {growth !== undefined && (
                    <div className="mt-4 flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${growth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {growth >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {Math.abs(growth).toFixed(1)}%
                        </span>
                        <span className="text-xs text-stone-400">vs. período anterior</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-stone-800 tracking-tight">Painel Financeiro</h2>
                    <p className="text-stone-500">Visão consolidada de resultados.</p>
                </div>
                
                {/* BOTÃO RELATÓRIO + FILTROS */}
                <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
                    <button 
                        onClick={() => { setShowReportModal(true); setReportResult(null); }} 
                        className="bg-white border border-stone-200 text-stone-600 hover:text-amber-600 hover:border-amber-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                        <FileText size={16} /> Relatório de Pagamentos
                    </button>

                    <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl border border-stone-200 shadow-sm">
                        <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-bold text-stone-700 outline-none hover:bg-stone-100 transition-colors cursor-pointer">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <div className="w-px bg-stone-200 mx-1"></div>
                        {['month', 'quarter', 'semester', 'year'].map(type => (
                            <button key={type} onClick={() => setPeriodType(type)} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${periodType === type ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-stone-500 hover:bg-stone-50'}`}>
                                {type === 'month' ? 'Mês' : type === 'quarter' ? 'Trimestre' : type === 'semester' ? 'Semestre' : 'Ano'}
                            </button>
                        ))}
                        <div className="w-px bg-stone-200 mx-1"></div>
                        {periodType !== 'year' && (
                            <select value={selectedPeriodValue} onChange={(e) => setSelectedPeriodValue(e.target.value)} className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-bold text-stone-700 outline-none min-w-[150px] cursor-pointer hover:bg-stone-100">
                                {periodType === 'month' && months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                {periodType === 'quarter' && quarters.map((q, i) => <option key={i} value={i}>{q}</option>)}
                                {periodType === 'semester' && semesters.map((s, i) => <option key={i} value={i}>{s}</option>)}
                            </select>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Faturamento" value={metricsCurrent.totalRev} isMoney={true} growth={growthRev} clickable={true} onClick={() => setShowRevenueDetails(true)} />
                <StatCard title="Pedidos" value={metricsCurrent.totalCount} isMoney={false} growth={growthCount} clickable={true} onClick={() => setShowItemDetails(true)} />
                <StatCard title="Custo Produtos" value={metricsCurrent.totalCost} isMoney={true} variant="cost" />
                <StatCard title="Lucro Líquido" value={metricsCurrent.totalResult} isMoney={true} growth={growthResult} margin={currentMargin} variant="profit" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* GRÁFICO MISTO */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <div><h3 className="font-bold text-stone-800 text-lg">Fluxo de Caixa ({selectedYear})</h3><p className="text-xs text-stone-400">Comparativo Receita x Despesa x Resultado</p></div>
                        <div className="flex gap-4 text-xs font-bold uppercase tracking-wider bg-stone-50 p-2 rounded-lg border border-stone-100">
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-400 rounded-sm"></div> Receita</div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-400 rounded-sm"></div> Custo</div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div> Resultado</div>
                        </div>
                    </div>
                    <div className="relative h-80 w-full pt-10 pb-8 px-4">
                        {/* Grades de Fundo */}
                        <div className="absolute inset-x-4 inset-y-8 flex flex-col justify-between pointer-events-none z-0">
                            <div className="border-t border-stone-100 border-dashed w-full h-px relative"><span className="absolute -top-3 -left-0 text-[9px] text-stone-300 font-mono">100%</span></div>
                            <div className="border-t border-stone-100 border-dashed w-full h-px relative"><span className="absolute -top-3 -left-0 text-[9px] text-stone-300 font-mono">50%</span></div>
                            <div className="border-t border-stone-200 w-full h-px relative"><span className="absolute -top-3 -left-0 text-[9px] text-stone-300 font-mono">0%</span></div>
                        </div>
                        <svg className="absolute inset-x-4 inset-y-8 w-[calc(100%-2rem)] h-[calc(100%-4rem)] pointer-events-none z-10 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <polyline points={polylinePoints} fill="none" stroke="#10b981" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
                        </svg>
                        <div className="absolute inset-x-4 inset-y-8 w-[calc(100%-2rem)] h-[calc(100%-4rem)] flex justify-between items-end z-20">
                            {annualStats.map((val, idx) => {
                                const revHeight = (val.rev / maxGraphVal) * 100;
                                const costHeight = (val.cost / maxGraphVal) * 100;
                                const displayRes = Math.max(0, val.res);
                                const resultBottomPercent = (displayRes / maxGraphVal) * 100;
                                const isHovered = hoveredIndex === idx;
                                return (
                                    <div key={idx} className={`flex-1 flex flex-col items-center relative h-full justify-end group transition-colors rounded-lg ${isHovered ? 'bg-stone-50' : ''}`} onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)}>
                                        <div className="absolute w-2 h-2 bg-emerald-500 rounded-full border border-white shadow-sm transition-transform duration-200" style={{ bottom: `calc(${resultBottomPercent}% - 4px)`, transform: isHovered ? 'scale(1.5)' : 'scale(1)' }}/>
                                        <div className={`absolute -top-12 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-[10px] p-2 rounded-lg shadow-xl z-50 pointer-events-none transition-all duration-200 w-32 flex flex-col gap-1 border border-stone-600 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                                            <div className="flex justify-between items-center"><span className="text-amber-300 font-bold">R</span> <span>{val.rev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                            <div className="flex justify-between items-center"><span className="text-red-300 font-bold">D</span> <span>{val.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                            <div className="border-t border-stone-600 mt-0.5 pt-0.5 flex justify-between items-center font-bold text-emerald-400"><span>L</span> <span>{val.res.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-800"></div>
                                        </div>
                                        <div className="w-full flex items-end justify-center gap-[2px] h-full px-1 sm:px-2 pb-6">
                                            <div className={`w-full max-w-[12px] sm:max-w-[20px] bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-md transition-all duration-500 shadow-sm ${isHovered ? 'opacity-100' : 'opacity-80'}`} style={{ height: `${revHeight}%` }}></div>
                                            <div className={`w-full max-w-[12px] sm:max-w-[20px] bg-gradient-to-t from-red-400 to-red-300 rounded-t-md transition-all duration-500 shadow-sm ${isHovered ? 'opacity-100' : 'opacity-80'}`} style={{ height: `${costHeight}%` }}></div>
                                        </div>
                                        <span className={`absolute bottom-0 text-[10px] sm:text-xs uppercase font-bold tracking-wider transition-colors ${isHovered ? 'text-stone-800' : 'text-stone-400'}`}>{months[idx].substring(0, 3)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                {/* PIZZA */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                    <h3 className="font-bold text-stone-800 mb-6 flex items-center gap-2"><PieChart className="text-amber-600" size={20}/> Categorias</h3>
                    <div className="space-y-5 overflow-y-auto max-h-[350px] custom-scrollbar pr-2">
                        {REPORT_CATEGORIES.map(cat => {
                            const val = metricsCurrent.revByCat[cat];
                            const total = metricsCurrent.totalRev || 1;
                            const percent = (val / total) * 100;
                            let colorClass = 'bg-stone-400';
                            if (cat === 'Casamento') colorClass = 'bg-pink-400';
                            else if (cat === 'Aniversário') colorClass = 'bg-blue-400';
                            else if (cat === 'Natal') colorClass = 'bg-red-400';
                            else if (cat === 'Batizado') colorClass = 'bg-cyan-400';
                            else if (cat === 'Primeira Eucaristia/ Crisma') colorClass = 'bg-yellow-400';
                            else if (cat === 'Páscoa') colorClass = 'bg-purple-400';
                            else if (cat === 'Confraternização') colorClass = 'bg-orange-400';
                            else if (cat === 'Eventos em Geral') colorClass = 'bg-stone-500';
                            if (val === 0) return null;
                            return (
                                <div key={cat} className="group">
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="font-bold text-stone-600 truncate mr-2 group-hover:text-amber-600 transition-colors">{cat}</span>
                                        <span className="font-mono text-stone-500 font-bold">{percent.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden"><div className={`h-full ${colorClass} group-hover:opacity-80 transition-all`} style={{ width: `${percent}%` }}></div></div>
                                    <div className="text-[10px] text-stone-400 mt-1 text-right font-mono">{val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                </div>
                            );
                        })}
                        {metricsCurrent.totalRev === 0 && <div className="text-center py-12"><div className="w-12 h-12 bg-stone-50 rounded-full mx-auto mb-2 flex items-center justify-center"><PieChart className="text-stone-300"/></div><p className="text-stone-400 text-xs">Sem dados para exibir.</p></div>}
                    </div>
                </div>
            </div>

            {/* MODAL RELATÓRIO DE PAGAMENTOS (CORRIGIDO: SOMA DOS VALORES) */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-3xl shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b pb-4 shrink-0">
                            <div><h3 className="text-xl font-serif font-bold text-stone-800">Relatório de Pagamentos</h3><p className="text-sm text-stone-500">Fluxo de caixa detalhado.</p></div>
                            <button onClick={() => setShowReportModal(false)} className="text-stone-400 hover:text-stone-600"><X size={24} /></button>
                        </div>

                        {/* Filtros */}
                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mb-6 flex flex-col sm:flex-row gap-4 items-end shrink-0">
                            <div className="flex-1 w-full"><label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Data Inicial</label><input type="date" value={reportDates.start} onChange={e => setReportDates({...reportDates, start: e.target.value})} className="w-full p-2 rounded border border-stone-300 outline-none focus:border-amber-400 text-sm" /></div>
                            <div className="flex-1 w-full"><label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Data Final</label><input type="date" value={reportDates.end} onChange={e => setReportDates({...reportDates, end: e.target.value})} className="w-full p-2 rounded border border-stone-300 outline-none focus:border-amber-400 text-sm" /></div>
                            <Button onClick={generatePaymentReport} className="w-full sm:w-auto h-[38px]"><Filter size={16} /> Gerar Relatório</Button>
                        </div>

                        {/* Tabela Resultado */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-lg border-stone-200">
                            {reportResult ? (
                                reportResult.length > 0 ? (
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-stone-100 text-stone-500 font-bold uppercase text-xs sticky top-0">
                                            <tr>
                                                <th className="p-3 border-b border-stone-200">Data</th>
                                                <th className="p-3 border-b border-stone-200 text-center">Qtd</th>
                                                <th className="p-3 border-b border-stone-200">Detalhamento por Método</th>
                                                <th className="p-3 border-b border-stone-200 text-right">Total Dia</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {reportResult.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-stone-50">
                                                    <td className="p-3 font-mono text-stone-600 align-top">{formatDateBr(row.date)}</td>
                                                    <td className="p-3 text-center font-bold text-stone-700 align-top">{row.count}</td>
                                                    {/* Coluna de Métodos */}
                                                    <td className="p-3 align-top">
                                                        <div className="flex flex-wrap gap-1">
                                                            {Object.entries(row.methods).map(([method, amount]) => (
                                                                <span key={method} className="text-[10px] bg-white border border-stone-200 px-2 py-1 rounded text-stone-600 flex items-center gap-1 shadow-sm">
                                                                    <span className="font-bold">{method}:</span> {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-emerald-600 align-top">{row.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-stone-50 font-bold sticky bottom-0 border-t border-stone-200">
                                            <tr>
                                                <td className="p-3 text-stone-800 uppercase text-xs">Total do Período</td>
                                                <td className="p-3 text-center text-stone-800">{reportResult.reduce((acc, curr) => acc + curr.count, 0)}</td>
                                                <td className="p-3"></td>
                                                <td className="p-3 text-right text-emerald-700 text-lg">{reportResult.reduce((acc, curr) => acc + curr.total, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                ) : (<div className="p-8 text-center text-stone-400 italic">Nenhum pagamento encontrado neste período.</div>)
                            ) : (
                                <div className="p-12 text-center text-stone-300 flex flex-col items-center"><Calendar size={48} className="mb-2 opacity-20"/><p>Selecione as datas para visualizar os pagamentos.</p></div>
                            )}
                        </div>
                    </Card>
                </div>
            )}
            
            {showRevenueDetails && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                            <div><h3 className="text-2xl font-serif font-bold text-stone-800">Detalhamento Financeiro</h3><p className="text-stone-500 text-sm">Entradas, pendências e parcelamentos do período.</p></div>
                            <button onClick={() => setShowRevenueDetails(false)} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            <section>
                                <h4 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Wallet size={16} /> Entradas por Método (Líquido)</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.entries(paymentStats).length > 0 ? (
                                        Object.entries(paymentStats).map(([method, stats]) => (
                                            <div key={method} className="bg-stone-50 border border-stone-200 p-4 rounded-xl flex flex-col hover:border-amber-200 transition-colors">
                                                <span className="text-xs font-bold text-stone-500 mb-1">{method}</span>
                                                <span className="text-xl font-bold text-stone-800 mb-1">{stats.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                {stats.count > 0 && <span className="text-xs text-stone-400 bg-white border border-stone-100 px-2 py-1 rounded w-fit">{stats.count} pedidos</span>}
                                            </div>
                                        ))
                                    ) : (<div className="col-span-full text-stone-400 italic text-sm">Nenhum pagamento registrado.</div>)}
                                </div>
                            </section>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <section className="bg-red-50/50 border border-red-100 rounded-xl p-5">
                                    <div className="flex justify-between items-center mb-4"><h4 className="text-sm font-bold text-red-700 uppercase tracking-wider flex items-center gap-2"><AlertTriangle size={16} /> Pendências (A Receber)</h4><span className="text-red-600 font-bold bg-white px-2 py-1 rounded text-xs shadow-sm border border-red-100">Total: {totalPendingValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                    <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {pendingPayments.length > 0 ? (
                                            <table className="w-full text-sm text-left"><thead className="text-red-400 text-xs font-bold uppercase border-b border-red-200"><tr><th className="pb-2">Cliente</th><th className="pb-2 text-right">A Receber</th></tr></thead>
                                            <tbody className="divide-y divide-red-100">{pendingPayments.map(p => { const paid = p.entryValue || 0; const remaining = p.totalValue - paid; return (<tr key={p.id}><td className="py-2 font-medium text-stone-700">{p.client}{p.paymentStatus === 'Parcial' && <span className="block text-[10px] text-stone-400 font-normal">Valor Total: {p.totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>}</td><td className="py-2 text-right font-bold text-red-600">{remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{p.paymentStatus === 'Parcial' && <span className="block text-[10px] text-emerald-600 font-normal">Pago: {paid.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>}</td></tr>); })}</tbody></table>
                                        ) : (<div className="flex flex-col items-center justify-center h-32 text-emerald-600"><CheckCircle size={32} className="mb-2 opacity-50" /><p className="font-bold">Tudo em dia!</p></div>)}
                                    </div>
                                </section>
                                <section className="bg-stone-50 border border-stone-200 rounded-xl p-5">
                                    <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4 flex items-center gap-2"><CreditCard size={16} /> Parcelamentos (Processado)</h4>
                                    <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {installmentPayments.length > 0 ? (
                                            <table className="w-full text-sm text-left"><thead className="text-stone-400 text-xs font-bold uppercase border-b border-stone-200"><tr><th className="pb-2">Cliente</th><th className="pb-2 text-center">x</th><th className="pb-2 text-right">Valor</th></tr></thead>
                                            <tbody className="divide-y divide-stone-100">{installmentPayments.map(p => { const parcelledValue = p.totalValue - (p.entryValue || 0); return (<tr key={p.id}><td className="py-2 font-medium text-stone-700 truncate max-w-[100px]">{p.client}{p.entryValue > 0 && <span className="block text-[10px] text-stone-400">Entrada: {p.entryValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>}</td><td className="py-2 text-center"><span className="bg-white border border-stone-200 px-2 py-0.5 rounded text-xs font-bold text-stone-600">{p.installments}x</span></td><td className="py-2 text-right font-bold text-stone-800">{parcelledValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>); })}</tbody></table>
                                        ) : (<div className="flex flex-col items-center justify-center h-32 text-stone-400"><p className="text-sm italic">Nenhum parcelamento.</p></div>)}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showItemDetails && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 shrink-0">
                            <div><h3 className="text-2xl font-serif font-bold text-stone-800">Detalhamento de Produtos</h3><p className="text-stone-500 text-sm">Volume de vendas e custos por item.</p></div>
                            <div className="flex items-center gap-4">
                                <div className="relative group">
                                    <label className="absolute -top-2.5 left-2 bg-stone-50 px-1 text-[10px] font-bold text-amber-600 uppercase tracking-wider z-10">Filtrar Categoria</label>
                                    <select value={itemCategoryFilter} onChange={(e) => setItemCategoryFilter(e.target.value)} className="h-10 pl-3 pr-8 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 outline-none w-48 appearance-none cursor-pointer hover:border-amber-400 transition-colors">{uniqueItemCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select>
                                    <Filter className="absolute right-2 top-2.5 text-stone-400 pointer-events-none" size={16} />
                                </div>
                                <button onClick={() => setShowItemDetails(false)} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-full transition-colors"><X size={24} /></button>
                            </div>
                        </div>
                        <div className="overflow-y-auto p-6 custom-scrollbar flex-1">
                            {filteredItemStats.length > 0 ? (
                                <table className="w-full text-left">
                                    <thead className="bg-stone-50 text-stone-500 text-xs font-bold uppercase tracking-wider sticky top-0 z-10"><tr><th className="p-3">Categoria</th><th className="p-3">Item / Descrição</th><th className="p-3 text-center">Qtd</th><th className="p-3 text-right">Faturamento</th><th className="p-3 text-right">Custo Total</th></tr></thead>
                                    <tbody className="divide-y divide-stone-100 text-sm">
                                        {filteredItemStats.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-amber-50/30 transition-colors"><td className="p-3"><span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-500 border border-stone-200">{item.category}</span></td><td className="p-3 font-medium text-stone-700">{item.desc}</td><td className="p-3 text-center font-bold text-stone-600 bg-stone-50/50 rounded">{item.qty}</td><td className="p-3 text-right font-bold text-amber-600">{item.totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right font-bold text-red-400">{item.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (<div className="flex flex-col items-center justify-center h-64 text-stone-400"><Package size={48} className="mb-4 opacity-20" /><p>Nenhum item encontrado.</p></div>)}
                        </div>
                        {itemCategoryFilter !== 'Todas' && filteredItemStats.length > 0 && (
                            <div className="bg-stone-50 border-t border-stone-200 p-4 flex justify-between items-center shrink-0">
                                <div className="text-xs font-bold text-stone-500 uppercase">Resumo: <span className="text-stone-800 text-sm ml-1">{itemCategoryFilter}</span></div>
                                <div className="flex gap-6"><div className="text-right"><p className="text-[10px] text-stone-400 uppercase font-bold">Total Custos</p><p className="text-lg font-bold text-red-500">{filteredItemTotals.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div><div className="text-right"><p className="text-[10px] text-stone-400 uppercase font-bold">Total Vendas</p><p className="text-lg font-bold text-amber-600">{filteredItemTotals.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div><div className="text-right pl-6 border-l border-stone-200"><p className="text-[10px] text-stone-400 uppercase font-bold">Resultado</p><p className="text-lg font-bold text-emerald-600">{(filteredItemTotals.revenue - filteredItemTotals.cost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div></div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- 7. DASHBOARD DE RESULTADOS (DRE) ---
const ResultDashboard = () => {
    const { userProfile } = useContext(AuthContext);
    
    // Filtros
    const [periodType, setPeriodType] = useState('month');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedPeriodValue, setSelectedPeriodValue] = useState(new Date().getMonth());
    
    // Dados do Banco
    const [budgets, setBudgets] = useState([]);
    const [products, setProducts] = useState([]);
    const [manualRecords, setManualRecords] = useState([]); // Registros manuais (aluguel, etc)
    const [launches, setLaunches] = useState([]); // Lançamentos (novos custos)

    // Estado Local de Edição
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        otherRevenues: 0
    });

    const years = [2025, 2026, 2027];
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const quarters = ["1º Trimestre (Jan-Mar)", "2º Trimestre (Abr-Jun)", "3º Trimestre (Jul-Set)", "4º Trimestre (Out-Dez)"];
    const semesters = ["1º Semestre (Jan-Jun)", "2º Semestre (Jul-Dez)"];

    // 1. Busca Dados (Orçamentos, Produtos e Registros Manuais)
    useEffect(() => {
        // Busca Budgets (Faturamento)
        const qBudgets = query(getColRef('budgets'), where('status', '==', 'approved'));
        const unsubBudgets = onSnapshot(qBudgets, (snap) => {
            const loaded = snap.docs.map(d => {
                const b = d.data();
                const parts = b.eventDate ? b.eventDate.split('-') : null;
                const date = parts ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
                let createdAtDate = new Date();
                if (b.createdAt && b.createdAt.seconds) createdAtDate = new Date(b.createdAt.seconds * 1000);
                else if (b.createdAt) createdAtDate = new Date(b.createdAt);
                
                return { 
                    id: d.id, 
                    date, 
                    createdAt: createdAtDate,
                    totalValue: parseFloat(b.totalValue) || 0,
                    items: b.items || []
                };
            });
            setBudgets(loaded);
        });

        // Busca Produtos (Para CMV)
        const unsubProducts = onSnapshot(getColRef('products'), (snap) => {
            setProducts(snap.docs.map(d => d.data()));
        });

        // Busca Registros Manuais (Despesas fixas salvas)
        // Buscamos TUDO do ano selecionado para facilitar a soma
        // ID do documento será: result_ANO_MES (ex: result_2026_0 para janeiro)
        const qRecords = query(collection(getFirestore(), 'financial_records')); 
        const unsubRecords = onSnapshot(qRecords, (snap) => {
            const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setManualRecords(loaded);
        });

        // Busca Lançamentos (Novos custos)
        const qLaunches = query(getColRef('launches'));
        const unsubLaunches = onSnapshot(qLaunches, (snap) => {
            setLaunches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubBudgets(); unsubProducts(); unsubRecords(); unsubLaunches(); };
    }, []);

    // Atualiza o formulário de edição quando muda o mês ou os dados carregados
    useEffect(() => {
        if (periodType === 'month') {
            const docId = `result_${selectedYear}_${selectedPeriodValue}`;
            const record = manualRecords.find(r => r.id === docId);
            if (record) {
                setEditData({
                    otherRevenues: record.otherRevenues || 0
                });
            } else {
                // Reseta se não houver registro
                setEditData({ otherRevenues: 0 });
            }
        }
        setIsEditing(false); // Sai do modo edição ao mudar filtro
    }, [periodType, selectedYear, selectedPeriodValue, manualRecords]);

    // --- FUNÇÃO PARA SOMAR CUSTOS DE LANÇAMENTOS ---
    const calculateLaunchesCosts = () => {
        let targetMonths = [];
        if (periodType === 'month') targetMonths = [parseInt(selectedPeriodValue)];
        else if (periodType === 'quarter') {
            const start = parseInt(selectedPeriodValue) * 3;
            targetMonths = [start, start + 1, start + 2];
        } else if (periodType === 'semester') {
            const start = parseInt(selectedPeriodValue) * 6;
            targetMonths = Array.from({length: 6}, (_, i) => start + i);
        } else {
            targetMonths = Array.from({length: 12}, (_, i) => i);
        }

        return launches.reduce((total, launch) => {
            if (!launch.date) return total;
            const launchDate = new Date(launch.date);
            const launchYear = launchDate.getFullYear();
            const launchMonth = launchDate.getMonth();
            
            if (launchYear === parseInt(selectedYear) && targetMonths.includes(launchMonth)) {
                return total + (parseFloat(launch.totalValue) || 0);
            }
            return total;
        }, 0);
    };

    // --- CÁLCULOS AUTOMÁTICOS (Igual ao Financeiro) ---
    const getProductCostAtDate = (productDesc, dateToCheck) => {
        const product = products.find(p => p.description === productDesc);
        if (!product || !product.costHistory || product.costHistory.length === 0) return 0;
        const entry = product.costHistory.find(h => {
            const [startYear, startMonth, startDay] = h.startDate.split('-').map(Number);
            const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0); 
            let endDate = null;
            if (h.endDate) {
                const [endYear, endMonth, endDay] = h.endDate.split('-').map(Number);
                endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59); 
            }
            return endDate ? (dateToCheck >= startDate && dateToCheck <= endDate) : (dateToCheck >= startDate);
        });
        return entry ? entry.cost : 0;
    };

    // --- AGREGADOR DE DADOS ---
    const calculateTotals = () => {
        // 1. Filtrar Orçamentos (Receita e CMV)
        const filteredBudgets = budgets.filter(b => {
            const bYear = b.date.getFullYear();
            const bMonth = b.date.getMonth();
            if (bYear !== parseInt(selectedYear)) return false;
            if (periodType === 'month') return bMonth === parseInt(selectedPeriodValue);
            if (periodType === 'quarter') return Math.floor(bMonth / 3) === parseInt(selectedPeriodValue);
            if (periodType === 'semester') return Math.floor(bMonth / 6) === parseInt(selectedPeriodValue);
            return true; // year
        });

        // Soma Automática
        const autoRevenue = filteredBudgets.reduce((acc, curr) => acc + curr.totalValue, 0);
        let autoCMV = 0;
        filteredBudgets.forEach(b => {
            b.items.forEach(item => {
                const qty = parseFloat(item.qty) || 0;
                const cost = getProductCostAtDate(item.desc, b.createdAt);
                autoCMV += (qty * cost);
            });
        });

        // 2. Somar Dados Manuais (Aluguel, etc.)
        // Precisamos saber quais meses compõem o período selecionado
        let targetMonths = [];
        if (periodType === 'month') targetMonths = [parseInt(selectedPeriodValue)];
        else if (periodType === 'quarter') {
            const start = parseInt(selectedPeriodValue) * 3;
            targetMonths = [start, start + 1, start + 2];
        } else if (periodType === 'semester') {
            const start = parseInt(selectedPeriodValue) * 6;
            targetMonths = Array.from({length: 6}, (_, i) => start + i);
        } else {
            targetMonths = Array.from({length: 12}, (_, i) => i);
        }

        const aggregatedManual = {
            otherRevenues: 0
        };

        // Se estiver no modo mês e editando, usa o estado local (input), senão soma do banco
        if (periodType === 'month' && isEditing) {
            Object.keys(aggregatedManual).forEach(k => aggregatedManual[k] = editData[k]);
        } else {
            targetMonths.forEach(m => {
                const docId = `result_${selectedYear}_${m}`;
                const record = manualRecords.find(r => r.id === docId);
                if (record) {
                    Object.keys(aggregatedManual).forEach(k => {
                        aggregatedManual[k] += (record[k] || 0);
                    });
                }
            });
        }

        // Totais Finais
        const totalRevenue = autoRevenue + aggregatedManual.otherRevenues;
        const launchesCosts = calculateLaunchesCosts();
        const netResult = totalRevenue - autoCMV - launchesCosts;

        return {
            autoRevenue,
            autoCMV,
            ...aggregatedManual,
            totalRevenue,
            launchesCosts,
            netResult
        };
    };

    const totals = calculateTotals();

    // --- HANDLERS ---
    const handleInputChange = (field, value) => {
        let val = value.replace(/\D/g, "");
        val = parseFloat(val) / 100;
        setEditData(prev => ({ ...prev, [field]: isNaN(val) ? 0 : val }));
    };

    const handleSave = async () => {
        if (periodType !== 'month') return;
        try {
            const docId = `result_${selectedYear}_${selectedPeriodValue}`;
            await setDoc(doc(collection(getFirestore(), 'financial_records'), docId), {
                ...editData,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile?.email || 'Sistema'
            });
            setIsEditing(false);
            alert("Dados salvos com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
        }
    };

    // --- RENDERIZADORES AUXILIARES ---
    const formatCurrency = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    // Calcula % sobre o Total de Receitas
    const calcPct = (val) => {
        if (totals.totalRevenue === 0) return '0.0%';
        return ((val / totals.totalRevenue) * 100).toFixed(1) + '%';
    };

    const renderRow = (label, value, colorClass, isInput = false, field = null, indent = false) => (
        <div className={`flex items-center py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors ${indent ? 'pl-8 bg-stone-50/50' : ''}`}>
            <div className={`flex-1 font-bold text-sm ${colorClass}`}>{label}</div>
            
            {/* Valor */}
            <div className="w-40 text-right pr-4">
                {isInput && isEditing && periodType === 'month' ? (
                    <input 
                        type="text" 
                        className={`w-full text-right bg-white border border-stone-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm ${colorClass}`}
                        value={editData[field].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                    />
                ) : (
                    <span className={`font-mono font-bold ${colorClass}`}>{formatCurrency(value)}</span>
                )}
            </div>

            {/* Porcentagem */}
            <div className="w-20 text-right text-xs text-stone-400 font-mono">
                {calcPct(value)}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
             {/* HEADER E FILTROS */}
             <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-stone-800 tracking-tight">Resultado (DRE)</h2>
                    <p className="text-stone-500">Análise detalhada de lucro e despesas.</p>
                </div>
                
                <div className="flex gap-2 bg-white p-2 rounded-xl border border-stone-200 shadow-sm items-center">
                    <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-bold text-stone-700 outline-none hover:bg-stone-100 cursor-pointer">{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
                    <div className="w-px bg-stone-200 h-8 mx-1"></div>
                    <select value={periodType} onChange={(e) => setPeriodType(e.target.value)} className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-bold text-stone-700 outline-none hover:bg-stone-100 cursor-pointer">
                        <option value="month">Mês</option>
                        <option value="quarter">Trimestre</option>
                        <option value="semester">Semestre</option>
                        <option value="year">Ano</option>
                    </select>
                    {periodType !== 'year' && (
                        <select value={selectedPeriodValue} onChange={(e) => setSelectedPeriodValue(e.target.value)} className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-bold text-stone-700 outline-none min-w-[150px] hover:bg-stone-100 cursor-pointer">
                            {periodType === 'month' && months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            {periodType === 'quarter' && quarters.map((q, i) => <option key={i} value={i}>{q}</option>)}
                            {periodType === 'semester' && semesters.map((s, i) => <option key={i} value={i}>{s}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* TABELA DE RESULTADOS */}
            <Card className="max-w-4xl mx-auto shadow-lg overflow-hidden border-t-4 border-t-amber-500">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-stone-100">
                    <h3 className="font-bold text-stone-800 text-lg flex items-center gap-2">
                        <FileText className="text-amber-600" /> Demonstrativo do Período
                    </h3>
                    
                    {/* Botões de Ação */}
                    {periodType === 'month' ? (
                        <div className="flex gap-2">
                            {isEditing ? (
                                <>
                                    <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancelar</Button>
                                    <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white"><Save size={16}/> Salvar</Button>
                                </>
                            ) : (
                                <Button onClick={() => setIsEditing(true)} className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"><Edit2 size={16}/> Editar Dados Manuais</Button>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-stone-400 italic bg-stone-50 px-3 py-1 rounded-full border border-stone-200">
                            Modo visualização (soma). Edite mês a mês.
                        </div>
                    )}
                </div>

                {/* --- GRUPO: RECEITAS (AZUL) --- */}
                <div className="mb-2">
                    {renderRow("(+) Faturamento", totals.autoRevenue, "text-blue-600")}
                    {renderRow("(+) Outras Receitas", totals.otherRevenues, "text-blue-600", true, "otherRevenues")}
                    <div className="border-t-2 border-blue-100 mt-1">
                        {renderRow("(=) TOTAL DE RECEITAS", totals.totalRevenue, "text-blue-700 text-lg uppercase")}
                    </div>
                </div>

                {/* --- GRUPO: CUSTOS --- */}
                <div className="mb-2">
                    {renderRow("(-) Custo Produtos", totals.autoCMV, "text-red-500")}
                    {renderRow("(-) Custos Lançamentos", totals.launchesCosts, "text-red-500")}
                </div>

                {/* --- RESULTADO LÍQUIDO (VERDE) --- */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2 mt-4">
                     {renderRow("(=) RESULTADO LÍQUIDO", totals.netResult, "text-emerald-700 text-xl uppercase")}
                </div>

            </Card>
        </div>
    );
};

// 7. USUÁRIOS (COM SENHA E PERMISSÕES DE EXCLUSÃO)
const UsersManager = () => {
    const { userProfile, hasRole } = useContext(AuthContext); // Importante: usar hasRole
    const [usersList, setUsersList] = useState([]);
    
    // Campos do formulário
    const [newUsername, setNewUsername] = useState('');
    const [newName, setNewName] = useState('');
    const [newPassword, setNewPassword] = useState(''); // Novo campo de senha
    const [newUserRole, setNewUserRole] = useState('operator');

    useEffect(() => {
        const unsub = onSnapshot(getColRef('users'), (s) => setUsersList(s.docs.map(d => d.data())));
        return () => unsub();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        
        if (!newUsername || !newName || !newPassword) {
            alert("Preencha todos os campos: Nome, Usuário e Senha.");
            return;
        }

        const exists = usersList.find(u => u.username === newUsername);
        if (exists) {
            alert("Este nome de usuário já está em uso.");
            return;
        }

        const fakeUid = "user_" + Math.random().toString(36).substr(2, 9);
        
        await setDoc(doc(getColRef('users'), fakeUid), {
            uid: fakeUid,
            username: newUsername,
            name: newName,
            password: newPassword, // Salvando a senha definida
            email: `${newUsername.toLowerCase().replace(/\s/g, '')}@interno.com`,
            role: newUserRole,
            createdAt: serverTimestamp()
        });
        
        // Limpar formulário
        setNewUsername('');
        setNewName('');
        setNewPassword('');
        alert("Usuário criado com sucesso!");
    };

    const handleUpdateRole = async (targetUid, newRole) => {
        await updateDoc(doc(getColRef('users'), targetUid), { role: newRole });
    };

    const handleDeleteUser = async (targetUid) => {
        if (confirm("Tem certeza que deseja excluir este usuário permanentemente?")) {
            await deleteDoc(doc(getColRef('users'), targetUid));
        }
    };

    // Permissão para ver as ações de edição/exclusão
    const canManageUsers = hasRole(['admin', 'manager']);

    return (
        <div className="space-y-6">
             <h2 className="text-2xl font-serif font-bold text-stone-800">Controle de Acesso</h2>
             
             {/* Apenas Admins e Gerentes podem criar usuários? Se for só Admin, mude para userProfile.role === 'admin' */}
             {canManageUsers && (
                 <Card className="bg-stone-50">
                     <h3 className="font-bold mb-4 flex items-center gap-2"><Plus size={18}/> Cadastrar Novo Usuário</h3>
                     <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                         
                         <div className="md:col-span-1">
                             <Input 
                                label="Nome Completo" 
                                value={newName} 
                                onChange={e => setNewName(e.target.value)} 
                                placeholder="Ex: Maria Silva" 
                                className="mb-0" 
                             />
                         </div>

                         <div className="md:col-span-1">
                             <Input 
                                label="Usuário (Login)" 
                                value={newUsername} 
                                onChange={e => setNewUsername(e.target.value)} 
                                placeholder="Ex: maria.silva" 
                                className="mb-0" 
                             />
                         </div>

                         <div className="md:col-span-1">
                             <Input 
                                label="Senha de Acesso" 
                                type="password"
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)} 
                                placeholder="******" 
                                className="mb-0" 
                             />
                         </div>

                         <div className="md:col-span-1 mb-4">
                             <label className="block text-stone-600 text-sm font-semibold mb-1">Cargo</label>
                             <select 
                                className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none bg-white" 
                                value={newUserRole} 
                                onChange={e => setNewUserRole(e.target.value)}
                             >
                                 <option value="manager">Gerente</option>
                                 <option value="operator">Operador</option>
                             </select>
                         </div>

                         <div className="mb-4">
                            <Button type="submit" className="w-full justify-center">Salvar</Button>
                         </div>
                     </form>
                 </Card>
             )}

             <Card>
                 {/* ADICIONADO: Div para rolagem */}
                 <div className="overflow-x-auto">
                     {/* ADICIONADO: min-w-[600px] */}
                     <table className="w-full min-w-[600px]">
                        <thead>
                             <tr className="text-left text-stone-500 text-sm border-b font-serif">
                                 <th className="p-3">Nome</th>
                                 <th className="p-3">Usuário</th>
                                 <th className="p-3">Cargo</th>
                                 <th className="p-3 text-right">Ações</th>
                             </tr>
                         </thead>
                         <tbody>
                             {usersList.map(u => {
                                 const isMainAdmin = u.username === 'admin' || u.email === 'admin';
                                 const showActions = canManageUsers && !isMainAdmin;
                                 
                                 return (
                                     <tr key={u.uid} className="border-b last:border-0 hover:bg-amber-50/50">
                                         <td className="p-3 font-bold text-stone-700">{u.name}</td>
                                         <td className="p-3 font-mono text-stone-600 bg-stone-50 rounded w-max px-2 py-1 text-xs">
                                             {u.username}
                                         </td>
                                         <td className="p-3"><Badge status={u.role} /></td>
                                         <td className="p-3 text-right">
                                             {showActions ? (
                                                 <div className="flex justify-end gap-2 items-center">
                                                     <select 
                                                        value={u.role} 
                                                        onChange={(e) => handleUpdateRole(u.uid, e.target.value)}
                                                        className="text-xs border border-stone-300 rounded p-1 bg-white outline-none focus:border-amber-500 mr-2"
                                                     >
                                                         <option value="admin">Admin</option>
                                                         <option value="manager">Gerente</option>
                                                         <option value="operator">Operador</option>
                                                     </select>
    
                                                     <button onClick={() => handleDeleteUser(u.uid)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                         <Trash2 size={16} />
                                                     </button>
                                                 </div>
                                             ) : (
                                                <div className="flex justify-end"><Lock size={14} className="text-stone-300" /></div>
                                             )}
                                         </td>
                                     </tr>
                                );
                            })}
                         </tbody>
                     </table>
                 </div>
             </Card>
        </div>
    );
};

// --- LAYOUT PRINCIPAL RESPONSIVO ---

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
      active 
      ? 'bg-amber-600 text-white shadow-lg' 
      : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
    }`}
  >
    <Icon size={20} />
    {label}
  </button>
);

const MainLayout = ({ children }) => {
  const { userProfile, hasRole, setUserProfile } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notificationCount, setNotificationCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Apenas Admins e Gerentes monitoram notificações de aprovação
    if (!hasRole(['admin', 'manager'])) return;
    
    const q1 = query(getColRef('budgets'));
    const u1 = onSnapshot(q1, s => {
        const p1 = s.docs.filter(d => d.data().status === 'pending').length;
        setNotificationCount(p1);
    }); 
    return () => u1();
  }, [hasRole]);

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'clients': return <ClientsManager />;
      case 'products': return <ProductsManager />;
      case 'budgets': return <BudgetManager />;
      case 'launches': return <LaunchesManager />;
      
      // PROTEÇÃO DE RENDERIZAÇÃO:
      // Se tentar acessar 'financial' ou 'result' sem permissão, mostra o Dashboard comum.
      case 'financial': 
        return hasRole(['admin', 'manager']) ? <FinancialDashboard /> : <Dashboard />;
        
      case 'result': 
        return hasRole(['admin', 'manager']) ? <ResultDashboard /> : <Dashboard />;
        
      case 'approvals': return <Approvals />;
      case 'users': return <UsersManager />;
      default: return <Dashboard />;
    }
};

  const handleLogout = async () => {
      try {
        await signOut(auth);
        if (setUserProfile) setUserProfile(null);
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/";
      } catch (error) {
        window.location.reload();
      }
  };

  const handleNavClick = (tab) => {
      setActiveTab(tab);
      setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden font-sans">
      
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden glass"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        w-64 bg-stone-900 flex flex-col shadow-2xl 
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        print:hidden
      `}>
        <div className="p-6 flex items-center gap-3 text-amber-500 border-b border-stone-800 justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <Cake size={32} />
            <div>
                <h1 className="font-bold text-lg font-serif leading-tight text-stone-100">Taio Dagnoni</h1>
                <p className="text-xs text-stone-500">Confeitaria Artística</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-stone-400">
            <XCircle size={24} />
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-1 overflow-y-auto">
    <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
    
    {/* PROTEÇÃO DE VISUALIZAÇÃO DO MENU: SÓ ADMIN E GERENTE VÊEM DADOS FINANCEIROS */}
    {hasRole(['admin', 'manager']) && (
    <>
        <SidebarItem icon={PieChart} label="Financeiro" active={activeTab === 'financial'} onClick={() => handleNavClick('financial')} />
        {/* NOVO MENU RESULTADO */}
        <SidebarItem icon={TrendingUp} label="Resultado (DRE)" active={activeTab === 'result'} onClick={() => handleNavClick('result')} />
    </>
    )}

    <SidebarItem icon={FileText} label="Orçamentos" active={activeTab === 'budgets'} onClick={() => handleNavClick('budgets')} />
    <SidebarItem icon={Users} label="Clientes" active={activeTab === 'clients'} onClick={() => handleNavClick('clients')} />
    <SidebarItem icon={ShoppingBag} label="Produtos" active={activeTab === 'products'} onClick={() => handleNavClick('products')} />
    <SidebarItem icon={DollarSign} label="Lançamentos" active={activeTab === 'launches'} onClick={() => handleNavClick('launches')} />
    
    {hasRole(['admin', 'manager']) && (
    <div className="pt-4 mt-4 border-t border-stone-800">
        <p className="px-4 text-xs font-bold text-stone-600 uppercase mb-2">Gestão</p>
        <SidebarItem icon={CheckCircle} label={`Aprovações ${notificationCount > 0 ? '•' : ''}`} active={activeTab === 'approvals'} onClick={() => handleNavClick('approvals')} />
        <SidebarItem icon={Lock} label="Usuários" active={activeTab === 'users'} onClick={() => handleNavClick('users')} />
    </div>
    )}
</nav>

        <div className="p-4 border-t border-stone-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
              {userProfile?.name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-white truncate font-medium">{userProfile?.name}</p>
              <p className="text-xs text-stone-500 capitalize">{userProfile?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-stone-400 hover:text-white text-sm transition-colors py-2">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto relative w-full">
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 text-stone-600 hover:bg-stone-100 rounded-lg"
            >
                <Menu size={24} />
            </button>
            <h2 className="text-stone-400 font-medium text-sm hidden md:block">Controle Interno &gt; <span className="text-stone-800 capitalize">{activeTab === 'financial' ? 'Financeiro' : activeTab}</span></h2>
            <h2 className="text-stone-800 font-bold text-lg md:hidden capitalize">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-4">
             {hasRole(['admin', 'manager']) && notificationCount > 0 && (
                 <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse cursor-pointer" onClick={() => setActiveTab('approvals')}>
                     <AlertTriangle size={12} /> <span className="hidden md:inline">Pendências</span>
                 </div>
             )}
          </div>
        </header>
        
        {/* Largura ajustada para caber as tabelas grandes */}
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto print:p-0 print:w-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

const App = () => (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
);

const AppContent = () => {
  const { user, userProfile, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-stone-100 text-amber-600">
        <div className="animate-spin"><Cake size={48} /></div>
      </div>
    );
  }

  // Se não houver usuário OU não houver perfil carregado, mostra a tela de login
  if (!user || !userProfile) return <LoginScreen />;
  return <MainLayout />;
};

export default App;