import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { 
  Users, Calendar, DollarSign, LayoutDashboard, 
  LogOut, Plus, Trash2, Edit2, CheckCircle, 
  XCircle, AlertTriangle, Menu, ChefHat, FileText,
  Lock, Save, Search, Filter, Printer
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, 
  onAuthStateChanged, signOut, updateProfile 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, getDocs, getDoc, 
  setDoc, addDoc, updateDoc, deleteDoc, query, 
  onSnapshot, serverTimestamp 
} from 'firebase/firestore';

// --- CONFIGURAÇÃO FIREBASE (CORRIGIDO PARA USO REAL) ---
// ⚠️ SUBSTITUI OS VALORES ABAIXO PELOS QUE COPIASTE DO FIREBASE CONSOLE ⚠️
const firebaseConfig = {
  apiKey: "COLA_AQUI_A_TUA_API_KEY",
  authDomain: "COLA_AQUI_O_TEU_PROJECT_ID.firebaseapp.com",
  projectId: "COLA_AQUI_O_TEU_PROJECT_ID",
  storageBucket: "COLA_AQUI_O_TEU_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "COLA_AQUI_O_TEU_SENDER_ID",
  appId: "COLA_AQUI_O_TEU_APP_ID"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

// 1. LOGIN
const LoginScreen = () => {
  const { user, setUserProfile } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!user) return;

    const q = query(getColRef('users'));
    const snapshot = await getDocs(q);
    const usersList = snapshot.docs.map(d => d.data());
    const foundUser = usersList.find(u => u.email === email);

    if (foundUser) {
      // Simplificação: Aceitamos o usuário encontrado sem re-auth complexo para este demo
      setUserProfile(foundUser);
    } else {
      if (email === 'admin@padaria.com' && password === '&mpresa00') {
        const adminData = {
          uid: user.uid,
          email: 'admin@padaria.com',
          name: 'Administrador Principal',
          role: 'admin',
          createdAt: serverTimestamp()
        };
        await setDoc(doc(getColRef('users'), user.uid), adminData);
        setUserProfile(adminData);
      } else {
        alert("Usuário não encontrado. Use admin@padaria.com / &mpresa00 para o primeiro acesso.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-amber-600 p-8 text-center">
          <ChefHat className="w-16 h-16 text-white mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white font-serif">La Boulangerie</h1>
          <p className="text-amber-100">Sistema de Controle Interno</p>
        </div>
      
        <div className="p-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-6">Acesso ao Sistema</h2>
          <form onSubmit={handleLogin}>
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ex: admin@padaria.com"/>
            <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="******"/>
            <Button type="submit" className="w-full justify-center mt-4">Entrar</Button>
          </form>
     
          <div className="mt-4 text-xs text-stone-500 text-center">
            <p>Credenciais Padrão: admin@padaria.com | &mpresa00</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. DASHBOARD
const Dashboard = () => {
  const { userProfile } = useContext(AuthContext);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const q = query(getColRef('budgets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const budgetEvents = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => b.status === 'approved' && b.eventDate)
        .map(b => ({
          date: new Date(b.eventDate),
          title: b.typeOfConfectionery || 'Encomenda',
          client: b.clientData?.name,
          value: b.totalValue
        }));
      setEvents(budgetEvents);
    });
    return () => unsubscribe();
  }, []);

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif font-bold text-stone-800">Painel Geral</h2>
        <div className="text-stone-500">Bem-vindo, {userProfile?.name}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-none">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-full"><Calendar size={24} /></div>
            <div>
              <p className="text-amber-100 text-sm">Próximos Eventos</p>
              <p className="text-2xl font-bold">{events.filter(e => e.date >= today).length}</p>
            </div>
          </div>
        </Card>
      </div>
      <Card>
        <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
          <Calendar className="text-amber-600" /> Agenda de Produção (Mês Atual)
        </h3>
        <div className="grid grid-cols-7 gap-2 text-center text-sm mb-2 text-stone-500 font-semibold">
          <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sab</div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => {
            const dayEvents = events.filter(e => e.date.getDate() === day && e.date.getMonth() === today.getMonth());
            return (
              <div key={day} className={`min-h-[80px] border rounded-lg p-1 text-left relative group ${dayEvents.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-100'}`}>
                <span className="text-xs font-bold text-stone-400 ml-1">{day}</span>
                <div className="mt-1 space-y-1">
                  {dayEvents.map((evt, idx) => (
                    <div key={idx} className="text-[10px] bg-white border border-amber-200 text-stone-700 px-1 rounded truncate shadow-sm" title={`${evt.client} - R$ ${evt.value}`}>
                      {evt.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// 3. GESTÃO DE CLIENTES
const ClientsManager = () => {
  const { userProfile, hasRole } = useContext(AuthContext);
  const [clients, setClients] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', tradeName: '', cnpj: '', phone: '', address: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(getColRef('clients'), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleCpfCnpjChange = (e) => {
    const masked = maskCpfCnpj(e.target.value);
    setFormData({ ...formData, cnpj: masked });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.cnpj || !formData.phone || !formData.address) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
    }

    setIsSaving(true);
    try {
      await addDoc(getColRef('clients'), {
        ...formData,
        createdBy: userProfile?.email || 'Sistema', 
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setFormData({ name: '', tradeName: '', cnpj: '', phone: '', address: '' });
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar cliente: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (clientId) => {
    if (userProfile?.role === 'operator') { 
      const reason = prompt("Justificativa para exclusão:");
      if (!reason) return;
      await addDoc(getColRef('deletion_requests'), {
        targetId: clientId,
        targetCollection: 'clients',
        targetName: clients.find(c => c.id === clientId)?.name,
        requestedBy: userProfile?.email, 
        reason,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert("Solicitação de exclusão enviada ao Gerente.");
    } else {
      if (confirm("Confirmar exclusão?")) await deleteDoc(doc(getColRef('clients'), clientId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif font-bold text-stone-800">Clientes</h2>
        <Button onClick={() => setIsModalOpen(true)}><Plus size={18} /> Novo Cliente</Button>
      </div>

      <div className="bg-white rounded-xl shadow border border-stone-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="p-4 w-10">#</th>
              <th className="p-4 text-stone-600 font-semibold text-sm">Nome / Fantasia</th>
              <th className="p-4 text-stone-600 font-semibold text-sm">CPF / CNPJ</th>
              <th className="p-4 text-stone-600 font-semibold text-sm">Contato</th>
              <th className="p-4 text-stone-600 font-semibold text-sm">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {clients.map(client => (
              <tr key={client.id} className="hover:bg-amber-50/30">
                <td className="p-4"><div className="w-2 h-2 rounded-full bg-amber-400"></div></td>
                <td className="p-4">
                  <div className="font-bold text-stone-800">{client.name}</div>
                  <div className="text-xs text-stone-500">{client.tradeName}</div>
                </td>
                <td className="p-4 text-sm text-stone-600 font-mono">{client.cnpj}</td>
                <td className="p-4 text-sm text-stone-600">
                    <div>{client.phone}</div>
                    <div className="text-xs truncate max-w-[150px]">{client.address}</div>
                </td>
                <td className="p-4">
                  <button onClick={() => handleDelete(client.id)} className="text-stone-400 hover:text-red-600 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && <div className="p-8 text-center text-stone-400">Nenhum cliente cadastrado.</div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-serif font-bold mb-6 text-stone-800 border-b pb-2">Cadastrar Novo Cliente</h3>
            <form onSubmit={handleSave}>
              <Input label="Razão Social / Nome Completo *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              <Input label="Nome Fantasia" value={formData.tradeName} onChange={e => setFormData({...formData, tradeName: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <Input 
                    label="CPF / CNPJ *" 
                    value={formData.cnpj} 
                    onChange={handleCpfCnpjChange} 
                    placeholder="000.000.000-00"
                    maxLength={18}
                    required 
                 />
                <Input label="Telefone *" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required placeholder="(99) 99999-9999"/>
              </div>
              <Input label="Endereço Completo *" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required />
              <div className="flex justify-end gap-3 mt-8">
                <Button variant="secondary" onClick={(e) => { e.preventDefault(); setIsModalOpen(false); }}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Salvando...' : 'Salvar Cadastro'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

// 4. ORÇAMENTOS (MODERNIZADO: FOLHA DE PAPEL)
const BudgetManager = () => {
    const { userProfile } = useContext(AuthContext);
    const [view, setView] = useState('list');
    const [budgets, setBudgets] = useState([]);
    const [clients, setClients] = useState([]);
    
    // Form State
    const [selectedClient, setSelectedClient] = useState('');
    const [date, setDate] = useState('');
    const [confType, setConfType] = useState('Bolos');
    const [items, setItems] = useState([{ desc: '', val: 0 }]);

    useEffect(() => {
        const unsubB = onSnapshot(getColRef('budgets'), (s) => setBudgets(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubC = onSnapshot(getColRef('clients'), (s) => setClients(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { unsubB(); unsubC(); }
    }, []);

    const total = items.reduce((acc, curr) => acc + (parseFloat(curr.val) || 0), 0);

    const handleSubmit = async () => {
        if (!selectedClient || !date) return alert("Preencha cliente e data.");
        const clientObj = clients.find(c => c.id === selectedClient);

        await addDoc(getColRef('budgets'), {
            clientData: clientObj,
            eventDate: date,
            typeOfConfectionery: confType,
            items,
            totalValue: total,
            status: 'pending',
            createdBy: userProfile?.email || 'Sistema', 
            createdAt: serverTimestamp()
        });
        setView('list');
        setItems([{ desc: '', val: 0 }]);
        setDate('');
        setSelectedClient('');
    };

    const addItem = () => setItems([...items, { desc: '', val: 0 }]);

    const updateItem = (idx, field, val) => {
        const newItems = [...items];
        newItems[idx][field] = val;
        setItems(newItems);
    };

    // Componente de input visualmente "limpo" para a folha de papel
    const PaperInput = ({ className, ...props }) => (
        <input 
            {...props}
            className={`bg-transparent border-b border-stone-300 focus:border-amber-600 outline-none py-1 transition-colors font-medium text-stone-800 placeholder-stone-400 ${className}`} 
        />
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center no-print">
                <h2 className="text-2xl font-serif font-bold text-stone-800">Orçamentos</h2>
                {view === 'list' && (
                    <Button onClick={() => setView('create')}>
                       <Plus size={18} /> Novo Orçamento
                    </Button>
                )}
            </div>

            {view === 'create' ? (
                <div className="flex flex-col items-center">
                    {/* FOLHA DE PAPEL CONTAINER */}
                    <div className="w-full max-w-3xl bg-white shadow-2xl min-h-[800px] p-12 relative print:shadow-none">
                        {/* Header da Folha */}
                        <div className="flex justify-between items-start border-b-2 border-amber-600 pb-6 mb-8">
                            <div className="flex items-center gap-4 text-amber-600">
                                <ChefHat size={48} />
                                <div>
                                    <h1 className="font-serif text-3xl font-bold text-stone-800">La Boulangerie</h1>
                                    <p className="text-sm font-serif italic text-stone-500">Confeitaria Artesanal & Padaria</p>
                                </div>
                            </div>
                            <div className="text-right text-stone-400 text-sm">
                                <p>Orçamento Nº {Math.floor(Math.random() * 10000)}</p>
                                <p>{new Date().toLocaleDateString()}</p>
                            </div>
                        </div>

                        {/* Corpo do Orçamento */}
                        <div className="space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Cliente</label>
                                    <select 
                                        className="bg-transparent border-b border-stone-300 py-1 outline-none focus:border-amber-600 font-serif text-lg"
                                        value={selectedClient} 
                                        onChange={e => setSelectedClient(e.target.value)}
                                    >
                                        <option value="">Selecione um cliente...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Data do Evento</label>
                                    <PaperInput type="date" value={date} onChange={e => setDate(e.target.value)} />
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Categoria do Pedido</label>
                                <div className="flex gap-4 pt-2">
                                    {['Bolos', 'Doces Finos', 'Salgados', 'Kit Festa'].map(type => (
                                        <label key={type} className="flex items-center gap-2 cursor-pointer group">
                                            <input 
                                                type="radio" 
                                                name="confType" 
                                                value={type} 
                                                checked={confType === type}
                                                onChange={() => setConfType(type)}
                                                className="accent-amber-600"
                                            />
                                            <span className={`text-sm ${confType === type ? 'text-amber-700 font-bold' : 'text-stone-500 group-hover:text-stone-700'}`}>{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6">
                                <div className="flex justify-between items-center mb-2 border-b border-stone-200 pb-2">
                                    <h3 className="font-serif font-bold text-stone-700">Descrição dos Itens</h3>
                                    <span className="text-xs font-bold text-stone-400">VALOR (R$)</span>
                                </div>
                                <div className="space-y-3 min-h-[300px]">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="flex gap-4 items-end group">
                                            <span className="text-stone-300 font-mono w-6 pt-2">{idx + 1}.</span>
                                            <PaperInput 
                                                placeholder="Descreva o produto..." 
                                                className="flex-1"
                                                value={item.desc}
                                                onChange={e => updateItem(idx, 'desc', e.target.value)}
                                            />
                                            <PaperInput 
                                                type="number" 
                                                placeholder="0,00" 
                                                className="w-32 text-right font-mono"
                                                value={item.val}
                                                onChange={e => updateItem(idx, 'val', parseFloat(e.target.value))}
                                            />
                                        </div>
                                    ))}
                                    <button onClick={addItem} className="flex items-center gap-2 text-amber-600 text-sm font-bold hover:text-amber-700 mt-4 px-2 py-1 rounded hover:bg-amber-50 transition-colors no-print">
                                        <Plus size={14} /> Adicionar Linha
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer / Totais */}
                        <div className="absolute bottom-12 right-12 left-12 border-t-2 border-stone-800 pt-4 flex justify-between items-end">
                            <div className="text-stone-400 text-xs">
                                <p>Este orçamento é válido por 10 dias.</p>
                                <p>Assinatura do Responsável: __________________________</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-stone-500 text-sm font-bold uppercase tracking-widest">Total Estimado</span>
                                <span className="block text-4xl font-serif font-bold text-stone-900">
                                    R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Botões de Ação Flutuantes */}
                    <div className="sticky bottom-4 flex gap-3 mt-8 bg-white/90 backdrop-blur p-4 rounded-full shadow-lg border border-stone-200">
                        <Button variant="secondary" onClick={() => setView('list')}>Cancelar</Button>
                        <Button variant="ghost" onClick={() => window.print()}><Printer size={18}/> Imprimir</Button>
                        <Button onClick={handleSubmit}><Save size={18} /> Salvar Orçamento</Button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {budgets.map(b => (
                        <Card key={b.id} className="hover:shadow-md transition-shadow relative group cursor-pointer border-l-4 border-l-amber-500">
                            <div className="absolute top-4 right-4"><Badge status={b.status} /></div>
                            <h4 className="font-bold text-stone-800 text-lg">{b.clientData?.name || "Cliente Removido"}</h4>
                            <p className="text-sm text-stone-500 mb-4">{b.typeOfConfectionery}</p>
                            
                            <div className="flex justify-between items-end border-t border-stone-100 pt-4">
                                <div className="text-xs text-stone-400 flex items-center gap-1">
                                    <Calendar size={12} /> {b.eventDate ? new Date(b.eventDate).toLocaleDateString() : 'Sem data'}
                                </div>
                                <div className="text-xl font-bold text-amber-600">R$ {b.totalValue?.toFixed(2)}</div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// 5. APROVAÇÕES E SOLICITAÇÕES
const Approvals = () => {
    const { userProfile } = useContext(AuthContext);
    const [tab, setTab] = useState('budgets');
    const [pendingBudgets, setPendingBudgets] = useState([]);
    const [deletions, setDeletions] = useState([]);

    useEffect(() => {
        const qB = query(getColRef('budgets'));
        const qD = query(getColRef('deletion_requests'));

        const unsubB = onSnapshot(qB, (s) => {
            setPendingBudgets(s.docs.map(d => ({id: d.id, ...d.data()})).filter(b => b.status === 'pending'));
        });
        const unsubD = onSnapshot(qD, (s) => {
            setDeletions(s.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.status === 'pending'));
        });
        return () => { unsubB(); unsubD(); }
    }, []);

    const handleBudgetAction = async (id, action) => {
        await updateDoc(doc(getColRef('budgets'), id), { status: action });
    };

    const handleDeletionAction = async (req, approved) => {
        if (approved) {
            await deleteDoc(doc(getColRef(req.targetCollection), req.targetId));
            await updateDoc(doc(getColRef('deletion_requests'), req.id), { status: 'resolved', resolution: 'approved' });
        } else {
            await updateDoc(doc(getColRef('deletion_requests'), req.id), { status: 'resolved', resolution: 'rejected' });
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-serif font-bold text-stone-800">Central de Aprovações</h2>
            
            <div className="flex gap-4 border-b border-stone-200">
                <button 
                    onClick={() => setTab('budgets')}
                    className={`pb-2 px-4 font-semibold ${tab === 'budgets' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-stone-400'}`}
                >
                    Orçamentos ({pendingBudgets.length})
                </button>
                <button 
                    onClick={() => setTab('deletions')}
                    className={`pb-2 px-4 font-semibold ${tab === 'deletions' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-stone-400'}`}
                >
                    Exclusões ({deletions.length})
                </button>
            </div>

            <div className="space-y-4">
                {tab === 'budgets' && pendingBudgets.map(item => (
                    <Card key={item.id} className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h4 className="font-bold">{item.clientData?.name} - {item.typeOfConfectionery}</h4>
                            <p className="text-amber-600 font-bold">R$ {item.totalValue?.toFixed(2)}</p>
                            <p className="text-xs text-stone-400">Criado por: {item.createdBy}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="danger" onClick={() => handleBudgetAction(item.id, 'rejected')}><XCircle size={18}/> Reprovar</Button>
                            <Button onClick={() => handleBudgetAction(item.id, 'approved')}><CheckCircle size={18}/> Aprovar</Button>
                        </div>
                    </Card>
                ))}

                {tab === 'deletions' && deletions.map(item => (
                    <Card key={item.id} className="flex justify-between items-center border-l-4 border-red-400">
                        <div>
                            <h4 className="font-bold text-red-800">Solicitação de Exclusão</h4>
                            <p className="text-sm">Alvo: <strong>{item.targetName}</strong> (Cliente)</p>
                            <p className="text-sm italic">" {item.reason} "</p>
                            <p className="text-xs text-stone-400">Solicitado por: {item.requestedBy}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => handleDeletionAction(item, false)}>Manter</Button>
                            <Button variant="danger" onClick={() => handleDeletionAction(item, true)}>Autorizar Exclusão</Button>
                        </div>
                    </Card>
                ))}
                
                {((tab === 'budgets' && pendingBudgets.length === 0) || (tab === 'deletions' && deletions.length === 0)) && (
                    <div className="text-center py-10 text-stone-400">Nenhuma pendência encontrada.</div>
                )}
            </div>
        </div>
    );
};

// 6. USUÁRIOS
const UsersManager = () => {
    const { userProfile } = useContext(AuthContext);
    const [usersList, setUsersList] = useState([]);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('operator');

    useEffect(() => {
        const unsub = onSnapshot(getColRef('users'), (s) => setUsersList(s.docs.map(d => d.data())));
        return () => unsub();
    }, []);

    const handleCreateUserPlaceholder = async (e) => {
        e.preventDefault();
        const fakeUid = "user_" + Math.random().toString(36).substr(2, 9);
        await setDoc(doc(getColRef('users'), fakeUid), {
            uid: fakeUid,
            email: newUserEmail,
            role: newUserRole,
            name: newUserEmail.split('@')[0],
            createdAt: serverTimestamp()
        });
        setNewUserEmail('');
    };

    const handleUpdateRole = async (targetUid, newRole) => {
        await updateDoc(doc(getColRef('users'), targetUid), { role: newRole });
    };

    return (
        <div className="space-y-6">
             <h2 className="text-2xl font-serif font-bold text-stone-800">Controle de Acesso</h2>
             
             {userProfile.role === 'admin' && (
                 <Card className="bg-stone-50">
                     <h3 className="font-bold mb-4">Pré-cadastrar Usuário (Simulação)</h3>
                     <form onSubmit={handleCreateUserPlaceholder} className="flex gap-4 items-end">
                         <div className="flex-1">
                             <Input label="Email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="novo@padaria.com" className="mb-0" />
                         </div>
                         <div className="w-40 mb-4">
                             <label className="block text-sm font-semibold mb-1">Cargo</label>
                             <select className="w-full border p-2 rounded" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                                 <option value="manager">Gerente</option>
                                 <option value="operator">Operador</option>
                             </select>
                         </div>
                         <div className="mb-4">
                            <Button type="submit">Adicionar</Button>
                         </div>
                     </form>
                 </Card>
             )}

             <Card>
                 <table className="w-full">
                     <thead>
                         <tr className="text-left text-stone-500 text-sm border-b">
                             <th className="p-3">Usuário</th>
                             <th className="p-3">Cargo</th>
                             <th className="p-3">Ações</th>
                         </tr>
                     </thead>
                     <tbody>
                         {usersList.map(u => {
                             const isMainAdmin = u.email === 'admin@padaria.com';
                             const canEdit = userProfile.role === 'admin' || (userProfile.role === 'manager' && !isMainAdmin);
                             return (
                                 <tr key={u.uid} className="border-b last:border-0">
                                     <td className="p-3 font-medium">{u.name || u.email} <br/><span className="text-xs text-stone-400">{u.email}</span></td>
                                     <td className="p-3"><Badge status={u.role} /></td>
                                     <td className="p-3">
                                         {canEdit && !isMainAdmin && (
                                             <select 
                                                value={u.role} 
                                                onChange={(e) => handleUpdateRole(u.uid, e.target.value)}
                                                className="text-sm border rounded p-1"
                                             >
                                                 <option value="admin">Admin</option>
                                                 <option value="manager">Gerente</option>
                                                 <option value="operator">Operador</option>
                                             </select>
                                         )}
                                         {!canEdit && <Lock size={14} className="text-stone-300" />}
                                     </td>
                                 </tr>
                             );
                         })}
                     </tbody>
                 </table>
             </Card>
        </div>
    );
};

// --- LAYOUT PRINCIPAL ---

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
  const { userProfile, hasRole } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (!hasRole(['admin', 'manager'])) return;
    const q1 = query(getColRef('budgets'));
    const u1 = onSnapshot(q1, s => {
        const p1 = s.docs.filter(d => d.data().status === 'pending').length;
        setNotificationCount(p1); // Corrigido para contar real
    }); 
    return () => u1();
  }, [hasRole]);

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'clients': return <ClientsManager />;
      case 'budgets': return <BudgetManager />;
      case 'approvals': return <Approvals />;
      case 'users': return <UsersManager />;
      default: return <Dashboard />;
    }
  };

  const handleLogout = () => signOut(auth);

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden font-sans">
      <aside className="w-64 bg-stone-900 flex flex-col shadow-2xl z-10 print:hidden">
        <div className="p-6 flex items-center gap-3 text-amber-500 border-b border-stone-800">
          <ChefHat size={32} />
          <div>
            <h1 className="font-bold text-lg font-serif leading-tight text-stone-100">La Boulangerie</h1>
            <p className="text-xs text-stone-500">System v1.0</p>
          </div>
        </div>

        <nav className="flex-1 py-6 space-y-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Users} label="Clientes" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} />
          <SidebarItem icon={FileText} label="Orçamentos" active={activeTab === 'budgets'} onClick={() => setActiveTab('budgets')} />
          
          {hasRole(['admin', 'manager']) && (
            <div className="pt-4 mt-4 border-t border-stone-800">
              <p className="px-4 text-xs font-bold text-stone-600 uppercase mb-2">Gestão</p>
              <SidebarItem icon={CheckCircle} label={`Aprovações ${notificationCount > 0 ? '•' : ''}`} active={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')} />
              <SidebarItem icon={Lock} label="Usuários" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-stone-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold">
              {userProfile?.name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-white truncate font-medium">{userProfile?.name}</p>
              <p className="text-xs text-stone-500 capitalize">{userProfile?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-stone-400 hover:text-white text-sm transition-colors py-2">
            <LogOut size={16} /> Sair do Sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto relative">
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-8 sticky top-0 z-10 print:hidden">
          <h2 className="text-stone-400 font-medium text-sm">Controle Interno &gt; <span className="text-stone-800 capitalize">{activeTab}</span></h2>
          <div className="flex items-center gap-4">
             {hasRole(['admin', 'manager']) && notificationCount > 0 && (
                 <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse cursor-pointer" onClick={() => setActiveTab('approvals')}>
                     <AlertTriangle size={12} /> Pendências
                 </div>
             )}
          </div>
        </header>
        <div className="p-8 max-w-6xl mx-auto print:p-0 print:w-full print:max-w-none">
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
        <div className="animate-spin"><ChefHat size={48} /></div>
      </div>
    );
  }

  // Se não houver usuário OU não houver perfil carregado, mostra a tela de login
  if (!user || !userProfile) return <LoginScreen />;
  return <MainLayout />;
};

export default App;