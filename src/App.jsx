import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, deleteUser } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './index.css'

// --- Icon SVGs ---
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const CheckCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-current text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;
const AlertTriangleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-current text-red-500"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;


ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: import.meta.env.VITE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_ID,
    measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Contexts ---
const AuthContext = createContext(null);
const NotificationContext = createContext(null);

// --- Notification Provider ---
const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((message, type = 'success') => {
        const id = Math.random();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 4000);
    }, []);

    return (
        <NotificationContext.Provider value={{ addNotification }}>
            {children}
            <NotificationContainer notifications={notifications} />
        </NotificationContext.Provider>
    );
};

// --- Auth Provider ---
const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
                    setUser(firebaseUser);
                    if (doc.exists()) {
                        setUserData({ uid: doc.id, ...doc.data() });
                    } else {
                        setUserData(null);
                    }
                    setLoading(false);
                });
                return () => unsubscribeUser();
            } else {
                setUser(null);
                setUserData(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, userData, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

// --- Custom Hooks ---
const useAuth = () => useContext(AuthContext);
const useNotifier = () => useContext(NotificationContext);


// --- Root App Component ---
export default function App() {
    return (
        <NotificationProvider>
            <AuthProvider>
                <HootoneApp />
            </AuthProvider>
        </NotificationProvider>
    );
}

// --- Main Application Logic Component ---
function HootoneApp() {
    const [currentPage, setCurrentPage] = useState('dashboard');
    const authContext = useAuth();

    if (!authContext) return <div className="loading-screen">Initializing Auth...</div>;

    const { user, userData, loading } = authContext;

    if (loading) return <div className="loading-screen">Loading Application...</div>;
    if (!user) return <LoginScreen />;
    if (!userData) return <div className="loading-screen">Loading User Data...</div>;

    const navigateTo = (page) => setCurrentPage(page);

    return (
        <div className="bg-slate-100 min-h-screen font-sans">
            <Header navigateTo={navigateTo} userRole={userData?.role} />
            <main className="p-4 sm:p-6 lg:p-8">
                {currentPage === 'dashboard' && <Dashboard user={userData} />}
                {currentPage === 'customers' && <AllCustomersList user={userData} />}
                {currentPage === 'add-sale' && <AddSaleForm user={userData} navigateTo={navigateTo} />}
                {userData?.role === 'admin' && currentPage === 'manage-team' && <ManageTeam />}
                {userData?.role === 'admin' && currentPage === 'manage-medicines' && <ManageMedicines />}
                {currentPage === 'analytics' && <AnalyticsDashboard user={userData} />}
            </main>
        </div>
    );
}

// --- UI & Feature Components ---

const Header = ({ navigateTo, userRole }) => {
    const handleSignOut = async () => {
        await signOut(auth);
    };

    const navLinkStyle = "text-slate-600 hover:text-indigo-600 font-medium transition-colors duration-200";
    const activeNavLinkStyle = "text-indigo-600 font-semibold"; // Example for active state

    return (
        <header className="bg-white shadow-sm sticky top-0 z-40">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-3">
                    <div className="flex items-center space-x-4">
                        <img
                            src="https://hootone.org/wp-content/uploads/2024/06/cropped-Logo-website.jpg"
                            alt="Hootone Remedies Logo"
                            className="h-10 w-auto"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                        />
                        <h1 className="text-xl font-bold text-slate-800 hidden">Hootone Remedies</h1>
                    </div>
                    <nav className="hidden md:flex items-center space-x-6">
                        <button onClick={() => navigateTo('dashboard')} className={navLinkStyle}>Dashboard</button>
                        <button onClick={() => navigateTo('customers')} className={navLinkStyle}>Customers</button>
                        <button onClick={() => navigateTo('add-sale')} className={navLinkStyle}>Add Sale</button>
                        <button onClick={() => navigateTo('analytics')} className={navLinkStyle}>Analytics</button>
                        {userRole === 'admin' && (
                            <>
                                <button onClick={() => navigateTo('manage-team')} className={navLinkStyle}>Team</button>
                                <button onClick={() => navigateTo('manage-medicines')} className={navLinkStyle}>Medicines</button>
                            </>
                        )}
                    </nav>
                    <button onClick={handleSignOut} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all duration-300 shadow-sm hover:shadow-md">
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
};

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <div className="text-center">
                    <img src="https://hootone.org/wp-content/uploads/2024/06/cropped-Logo-website.jpg" alt="Logo" className="mx-auto h-16 w-auto" />
                    <h1 className="mt-4 text-2xl font-bold text-slate-900">Hootone Remedies</h1>
                    <p className="mt-1 text-slate-600">Sales & Reminder System</p>
                </div>
                {error && <p className="form-error">{error}</p>}
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="form-label">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" required />
                    </div>
                    <div>
                        <label className="form-label">Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" required />
                    </div>
                    <div>
                        <button type="submit" disabled={loading} className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition duration-300 disabled:bg-indigo-400">
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Dashboard = ({ user }) => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('expiring_5_days');
    const [showReorderModal, setShowReorderModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);

    useEffect(() => {
        setLoading(true);
        const q = user.role === 'admin'
            ? query(collection(db, "sales"))
            : query(collection(db, "sales"), where("teamMemberId", "==", user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });

        return () => unsubscribe();
    }, [user]);

    const getFilteredSales = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return sales.filter(sale => {
            if (!sale.dosageEndDate?.seconds) return false;
            const endDate = new Date(sale.dosageEndDate.seconds * 1000);
            endDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

            if (filter === 'expiring_5_days') return diffDays >= 1 && diffDays <= 5;
            if (filter === 'expired_today') return diffDays === 0;
            if (filter === 'already_expired') return diffDays < 0;
            return false;
        }).sort((a, b) => a.dosageEndDate.seconds - b.dosageEndDate.seconds);
    };

    if (loading) return <div className="text-center p-10">Loading Dashboard...</div>;

    const filteredSales = getFilteredSales();

    return (
        <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 mb-6">Reminder Dashboard</h2>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex border-b mb-4">
                    <button onClick={() => setFilter('expiring_5_days')} className={`tab-button ${filter === 'expiring_5_days' && 'tab-button-active'}`}>Expiring in 5 Days</button>
                    <button onClick={() => setFilter('expired_today')} className={`tab-button ${filter === 'expired_today' && 'tab-button-active'}`}>Expiring Today</button>
                    <button onClick={() => setFilter('already_expired')} className={`tab-button ${filter === 'already_expired' && 'tab-button-active'}`}>Already Expired</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="table-header">Patient Name</th>
                                <th className="table-header">Phone</th>
                                <th className="table-header">Medicine</th>
                                <th className="table-header">Dosage End Date</th>
                                <th className="table-header">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSales.length > 0 ? filteredSales.map(sale => (
                                <tr key={sale.id} className="border-b border-slate-200 hover:bg-slate-50">
                                    <td className="table-cell font-medium text-slate-800">{sale.patientName}</td>
                                    <td className="table-cell">{sale.phoneNumber}</td>
                                    <td className="table-cell">{sale.medicineName}</td>
                                    <td className="table-cell">{new Date(sale.dosageEndDate.seconds * 1000).toLocaleDateString()}</td>
                                    <td className="table-cell">
                                        <div className="flex items-center space-x-2">
                                            <a href={`tel:${sale.phoneNumber}`} className="action-button-blue">Call</a>
                                            <button onClick={() => { setSelectedSale(sale); setShowReorderModal(true); }} className="action-button-green">Reorder</button>
                                            <a href={`https://wa.me/${sale.whatsappNumber || sale.phoneNumber}`} target="_blank" rel="noopener noreferrer" className="action-button-gray">WhatsApp</a>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="5" className="text-center p-6 text-slate-500">No patients in this category.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {showReorderModal && <ReorderModal sale={selectedSale} onClose={() => setShowReorderModal(false)} user={user} />}
        </div>
    );
};

const AllCustomersList = ({ user }) => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        setLoading(true);
        const q = user.role === 'admin'
            ? query(collection(db, "sales"))
            : query(collection(db, "sales"), where("teamMemberId", "==", user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });

        return () => unsubscribe();
    }, [user]);

    const filteredSales = sales.filter(sale =>
        sale.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.phoneNumber.includes(searchTerm)
    ).sort((a, b) => a.patientName.localeCompare(b.patientName));

    if (loading) return <div className="text-center p-10">Loading Customers...</div>;

    return (
        <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-800">All Customers</h2>
                <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-input w-full max-w-xs"
                />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="table-header">Patient Name</th>
                                <th className="table-header">Phone</th>
                                <th className="table-header">Last Medicine</th>
                                <th className="table-header">End Date</th>
                                {user.role === 'admin' && <th className="table-header">Rep</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSales.length > 0 ? filteredSales.map(sale => (
                                <tr key={sale.id} className="border-b border-slate-200 hover:bg-slate-50">
                                    <td className="table-cell font-medium text-slate-800">{sale.patientName}</td>
                                    <td className="table-cell">{sale.phoneNumber}</td>
                                    <td className="table-cell">{sale.medicineName}</td>
                                    <td className="table-cell">{sale.dosageEndDate ? new Date(sale.dosageEndDate.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                                    {user.role === 'admin' && <td className="table-cell">{sale.teamMemberName}</td>}
                                </tr>
                            )) : (
                                <tr><td colSpan={user.role === 'admin' ? 5 : 4} className="text-center p-6 text-slate-500">No customers found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AddSaleForm = ({ user, navigateTo }) => {
    const [formData, setFormData] = useState({
        patientName: '', phoneNumber: '', whatsappNumber: '', medicineId: '',
        price: '', optionalCharges: 0, purchaseDate: new Date().toISOString().split('T')[0], duration: 1
    });
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(false);
    const notifier = useNotifier();

    useEffect(() => {
        const fetchMedicines = async () => {
            const snapshot = await getDocs(collection(db, "medicines"));
            const meds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMedicines(meds);
            if (meds.length > 0) {
                setFormData(prev => ({ ...prev, medicineId: meds[0].id, price: meds[0].price }));
            }
        };
        fetchMedicines();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'medicineId') {
            const selectedMed = medicines.find(m => m.id === value);
            if (selectedMed) setFormData(prev => ({ ...prev, price: selectedMed.price }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { patientName, phoneNumber, whatsappNumber, medicineId, price, optionalCharges, purchaseDate, duration } = formData;
            const selectedMedicine = medicines.find(m => m.id === medicineId);
            const dosageEndDate = new Date(purchaseDate);
            dosageEndDate.setMonth(dosageEndDate.getMonth() + parseInt(duration));

            await addDoc(collection(db, "sales"), {
                patientName, phoneNumber, whatsappNumber: whatsappNumber || phoneNumber,
                medicineId, medicineName: selectedMedicine.name,
                price: parseFloat(price), optionalCharges: parseFloat(optionalCharges || 0),
                totalAmount: parseFloat(price) + parseFloat(optionalCharges || 0),
                purchaseDate: new Date(purchaseDate), duration: parseInt(duration),
                dosageEndDate, teamMemberId: user.uid, teamMemberName: user.name,
                createdAt: new Date(), history: [{ purchaseDate: new Date(purchaseDate), duration: parseInt(duration), dosageEndDate, updatedBy: user.name }],
                whatsappStatus: {}
            });

            notifier.addNotification("Sale added successfully!");
            navigateTo('dashboard');
        } catch (err) {
            notifier.addNotification("Failed to add sale: " + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-800 mb-6">Add New Sale</h2>
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="form-label">Patient Name</label>
                        <input name="patientName" value={formData.patientName} onChange={handleChange} className="form-input" required />
                    </div>
                    <div>
                        <label className="form-label">Phone Number</label>
                        <input name="phoneNumber" type="tel" value={formData.phoneNumber} onChange={handleChange} className="form-input" required />
                    </div>
                </div>
                <div>
                    <label className="form-label">WhatsApp Number (optional)</label>
                    <input name="whatsappNumber" type="tel" value={formData.whatsappNumber} onChange={handleChange} className="form-input" placeholder="Same as phone if left blank" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="form-label">Medicine</label>
                        <select name="medicineId" value={formData.medicineId} onChange={handleChange} className="form-input" required>
                            {medicines.map(med => <option key={med.id} value={med.id}>{med.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Price ($)</label>
                        <input name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} className="form-input" required />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="form-label">Optional Charges ($)</label>
                        <input name="optionalCharges" type="number" step="0.01" value={formData.optionalCharges} onChange={handleChange} className="form-input" />
                    </div>
                    <div>
                        <label className="form-label">Purchase Date</label>
                        <input name="purchaseDate" type="date" value={formData.purchaseDate} onChange={handleChange} className="form-input" required />
                    </div>
                </div>
                <div>
                    <label className="form-label">Duration (Months)</label>
                    <input name="duration" type="number" value={formData.duration} onChange={handleChange} min="1" className="form-input" required />
                </div>
                <div className="pt-4">
                    <button type="submit" disabled={loading} className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition duration-300 disabled:bg-indigo-400">
                        {loading ? 'Adding Sale...' : 'Add Sale'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const ManageMedicines = () => {
    const [medicines, setMedicines] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const notifier = useNotifier();

    const fetchMedicines = useCallback(() => {
        const unsubscribe = onSnapshot(collection(db, "medicines"), (snapshot) => {
            setMedicines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const unsubscribe = fetchMedicines();
        return () => unsubscribe();
    }, [fetchMedicines]);

    const handleEdit = (medicine) => {
        setSelectedMedicine(medicine);
        setShowEditModal(true);
    };

    const handleDelete = (medicine) => {
        setSelectedMedicine(medicine);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            await deleteDoc(doc(db, "medicines", selectedMedicine.id));
            notifier.addNotification("Medicine deleted successfully.");
        } catch (err) {
            notifier.addNotification("Error deleting medicine: " + err.message, 'error');
        } finally {
            setShowDeleteModal(false);
            setSelectedMedicine(null);
        }
    };

    return (
        <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-800">Manage Medicines</h2>
                <button onClick={() => setShowAddModal(true)} className="primary-button">Add New Medicine</button>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6">
                <ul className="space-y-4">
                    {medicines.map(med => (
                        <li key={med.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                            <div className="flex items-center space-x-4">
                                <img
                                    src={med.imageUrl || 'https://placehold.co/64x64/e2e8f0/475569?text=Med'}
                                    alt={med.name}
                                    className="h-16 w-16 rounded-md object-cover bg-slate-200"
                                />
                                <div>
                                    <p className="font-semibold text-slate-800">{med.name}</p>
                                    <p className="text-lg font-bold text-indigo-600">${med.price.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <button onClick={() => handleEdit(med)} className="icon-button-blue"><EditIcon /></button>
                                <button onClick={() => handleDelete(med)} className="icon-button-red"><TrashIcon /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            {showAddModal && <MedicineFormModal onClose={() => setShowAddModal(false)} />}
            {showEditModal && <MedicineFormModal medicine={selectedMedicine} onClose={() => { setShowEditModal(false); setSelectedMedicine(null); }} />}
            {showDeleteModal && <ConfirmDeleteModal onConfirm={confirmDelete} onCancel={() => setShowDeleteModal(false)} message={`Are you sure you want to delete ${selectedMedicine?.name}?`} />}
        </div>
    );
};

const ManageTeam = () => {
    const [team, setTeam] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);
    const notifier = useNotifier();

    useEffect(() => {
        const q = query(collection(db, "users"), where("role", "==", "team_member"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTeam(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe;
    }, []);

    const handleDelete = (member) => {
        setSelectedMember(member);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            // IMPORTANT: This only deletes the Firestore user document.
            // It does NOT delete the user from Firebase Authentication.
            // A Cloud Function is required to do that securely upon document deletion.
            await deleteDoc(doc(db, "users", selectedMember.id));
            notifier.addNotification("Team member removed.");
        } catch (err) {
            notifier.addNotification("Error removing member: " + err.message, 'error');
        } finally {
            setShowDeleteModal(false);
            setSelectedMember(null);
        }
    };

    return (
        <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-800">Manage Team</h2>
                <button onClick={() => setShowAddModal(true)} className="primary-button">Add New Member</button>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6">
                <ul className="space-y-3">
                    {team.map(member => (
                        <li key={member.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
                            <div>
                                <p className="font-semibold text-slate-800">{member.name}</p>
                                <p className="text-sm text-slate-500">{member.email}</p>
                            </div>
                            <button onClick={() => handleDelete(member)} className="icon-button-red"><TrashIcon /></button>
                        </li>
                    ))}
                </ul>
            </div>
            {showAddModal && <AddTeamMemberModal onClose={() => setShowAddModal(false)} />}
            {showDeleteModal && <ConfirmDeleteModal onConfirm={confirmDelete} onCancel={() => setShowDeleteModal(false)} message={`Are you sure you want to remove ${selectedMember?.name}? This action only removes them from the app, not their login.`} />}
        </div>
    );
};

// --- Modals and Forms ---

const MedicineFormModal = ({ medicine, onClose }) => {
    const [formData, setFormData] = useState({ name: '', price: '', imageUrl: '' });
    const [loading, setLoading] = useState(false);
    const notifier = useNotifier();
    const isEditMode = !!medicine;

    useEffect(() => {
        if (isEditMode) {
            setFormData({ name: medicine.name, price: medicine.price, imageUrl: medicine.imageUrl || '' });
        }
    }, [medicine, isEditMode]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const dataToSave = { ...formData, price: parseFloat(formData.price) };
            if (isEditMode) {
                await updateDoc(doc(db, "medicines", medicine.id), dataToSave);
                notifier.addNotification("Medicine updated successfully.");
            } else {
                await addDoc(collection(db, "medicines"), { ...dataToSave, createdAt: new Date() });
                notifier.addNotification("Medicine added successfully.");
            }
            onClose();
        } catch (err) {
            notifier.addNotification("Error saving medicine: " + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h3 className="text-2xl font-bold text-slate-800 mb-6">{isEditMode ? 'Edit Medicine' : 'Add New Medicine'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="form-label">Medicine Name</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="form-input" required />
                    </div>
                    <div>
                        <label className="form-label">Price ($)</label>
                        <input name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} className="form-input" required />
                    </div>
                    <div>
                        <label className="form-label">Image URL (optional)</label>
                        <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="form-input" />
                    </div>
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="secondary-button">Cancel</button>
                        <button type="submit" disabled={loading} className="primary-button">{loading ? 'Saving...' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AddTeamMemberModal = ({ onClose }) => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const notifier = useNotifier();

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            await setDoc(doc(db, "users", userCredential.user.uid), {
                name: formData.name, email: formData.email, role: 'team_member', createdAt: new Date()
            });
            notifier.addNotification("Team member added successfully.");
            onClose();
        } catch (err) {
            notifier.addNotification("Error adding member: " + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h3 className="text-2xl font-bold text-slate-800 mb-6">Add New Team Member</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="form-label">Name</label><input name="name" value={formData.name} onChange={handleChange} className="form-input" required /></div>
                    <div><label className="form-label">Email</label><input name="email" type="email" value={formData.email} onChange={handleChange} className="form-input" required /></div>
                    <div><label className="form-label">Password</label><input name="password" type="password" value={formData.password} onChange={handleChange} className="form-input" required /></div>
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="secondary-button">Cancel</button>
                        <button type="submit" disabled={loading} className="primary-button">{loading ? 'Adding...' : 'Add Member'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ReorderModal = ({ sale, onClose, user }) => {
    const [duration, setDuration] = useState(1);
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const notifier = useNotifier();

    const handleReorder = async () => {
        setLoading(true);
        try {
            const newDosageEndDate = new Date(purchaseDate);
            newDosageEndDate.setMonth(newDosageEndDate.getMonth() + parseInt(duration));

            const newHistoryEntry = { purchaseDate: new Date(purchaseDate), duration: parseInt(duration), dosageEndDate: newDosageEndDate, updatedBy: user.name, updatedAt: new Date() };

            await updateDoc(doc(db, "sales", sale.id), {
                purchaseDate: new Date(purchaseDate), duration: parseInt(duration), dosageEndDate: newDosageEndDate,
                history: [...(sale.history || []), newHistoryEntry]
            });
            notifier.addNotification("Reorder confirmed successfully.");
            onClose();
        } catch (err) {
            notifier.addNotification("Failed to update order: " + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h3 className="text-2xl font-bold mb-4">Reorder for {sale.patientName}</h3>
                <div className="space-y-4">
                    <div><label className="form-label">New Purchase Date</label><input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="form-input" /></div>
                    <div><label className="form-label">New Duration (Months)</label><input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="1" className="form-input" /></div>
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="secondary-button">Cancel</button>
                    <button onClick={handleReorder} disabled={loading} className="primary-button">{loading ? 'Updating...' : 'Confirm Reorder'}</button>
                </div>
            </div>
        </div>
    );
};

const ConfirmDeleteModal = ({ onConfirm, onCancel, message }) => (
    <div className="modal-backdrop">
        <div className="modal-content max-w-md">
            <div className="flex items-start space-x-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangleIcon />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-slate-900">Confirm Deletion</h3>
                    <div className="mt-2">
                        <p className="text-sm text-slate-500">{message}</p>
                    </div>
                </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={onConfirm} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:ml-3 sm:w-auto sm:text-sm">
                    Delete
                </button>
                <button type="button" onClick={onCancel} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm">
                    Cancel
                </button>
            </div>
        </div>
    </div>
);

const NotificationContainer = ({ notifications }) => (
    <div className="fixed top-5 right-5 z-50 space-y-3 w-full max-w-xs">
        {notifications.map(({ id, message, type }) => (
            <div key={id} className={`notification ${type === 'success' ? 'notification-success' : 'notification-error'}`}>
                {type === 'success' ? <CheckCircleIcon /> : <AlertTriangleIcon />}
                <p className="font-medium">{message}</p>
            </div>
        ))}
    </div>
);

const AnalyticsDashboard = ({ user }) => {
    // This component remains largely the same, just updating currency
    const [sales, setSales] = useState([]);
    useEffect(() => {
        const q = user.role === 'admin' ? collection(db, "sales") : query(collection(db, "sales"), where("teamMemberId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => setSales(snapshot.docs.map(doc => ({ ...doc.data(), purchaseDate: doc.data().purchaseDate.toDate() }))));
        return () => unsubscribe();
    }, [user]);

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                        return label;
                    }
                }
            }
        },
        scales: {
            y: { ticks: { callback: value => '$' + value } }
        }
    };

    const getChartData = (label, data) => ({
        labels: Object.keys(data),
        datasets: [{ label, data: Object.values(data), backgroundColor: 'rgba(79, 70, 229, 0.7)', borderColor: 'rgba(79, 70, 229, 1)', borderWidth: 1 }]
    });

    const salesByMonth = sales.reduce((acc, sale) => {
        const month = sale.purchaseDate.toLocaleString('default', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + sale.totalAmount;
        return acc;
    }, {});

    const salesByMedicine = sales.reduce((acc, sale) => {
        acc[sale.medicineName] = (acc[sale.medicineName] || 0) + sale.totalAmount;
        return acc;
    }, {});

    const salesByTeamMember = user.role === 'admin' ? sales.reduce((acc, sale) => {
        acc[sale.teamMemberName] = (acc[sale.teamMemberName] || 0) + sale.totalAmount;
        return acc;
    }, {}) : {};

    return (
        <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 mb-6">Sales Analytics</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-lg"><h3 className="font-bold mb-4">Sales by Month</h3><Bar data={getChartData('Sales by Month', salesByMonth)} options={chartOptions} /></div>
                <div className="bg-white p-6 rounded-xl shadow-lg"><h3 className="font-bold mb-4">Sales by Medicine</h3><Bar data={getChartData('Sales by Medicine', salesByMedicine)} options={chartOptions} /></div>
                {user.role === 'admin' && <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2"><h3 className="font-bold mb-4">Sales by Team Member</h3><Bar data={getChartData('Sales by Team Member', salesByTeamMember)} options={chartOptions} /></div>}
            </div>
        </div>
    );
};
