import {useCallback, useEffect, useState} from 'react';
import {LockKeyhole} from 'lucide-react';
import Layout from './components/Layout.jsx';
// import Dashboard from './pages/Dashboard.jsx';
// import Products, {ProductForm} from './pages/Products.jsx';
// import Categories from './pages/Categories.jsx';
// import Inventory from './pages/Inventory.jsx';
// import Sales, {NewSale} from './pages/Sales.jsx';
// import Reports from './pages/Reports.jsx';
// import Users from './pages/Users.jsx';
// import Settings, {Profile} from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import {useStore} from './StoreContext.jsx';

const currentRoute = () => window.location.hash.replace(/^#\/?/, '') || 'dashboard';
const roleRoutes = {
    'Inventory Staff': ['dashboard', 'products', 'inventory', 'sales', 'reports', 'profile'],
    Cashier: ['dashboard', 'products', 'sales', 'profile'],
};

function canAccess(route, role) {
    if (role === 'Administrator') return true;
    if (route === 'products/new' || route.startsWith('products/edit/') || (route === 'sales/new' && role === 'Inventory Staff')) return false;
    const root = route.split('/')[0] || 'dashboard';
    return (roleRoutes[role] || ['dashboard', 'profile']).includes(root);
}

function AccessDenied({navigate}) {
    return (
        <section className="card access-denied">
            <span><LockKeyhole size={30}/></span>
            <h1>Access restricted</h1>
            <p>Your demo role does not include permission to open this area. Sign in with an Administrator account to
                access every module.</p>
            <button className="button button-primary" onClick={() => navigate('dashboard')}>Return to Dashboard</button>
        </section>
    );
}

export default function App() {
    const {session, login, logout} = useStore();
    const [route, setRoute] = useState(currentRoute);

    useEffect(() => {
        const onHashChange = () => setRoute(currentRoute());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    useEffect(() => {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
    }, [route]);

    const navigate = useCallback((path) => {
        if (currentRoute() === path) {
            setRoute(path);
            window.scrollTo({top: 0, behavior: 'smooth'});
        } else {
            window.location.hash = path;
        }
    }, []);

    const signIn = (account, remember) => {
        login(account, remember);
        navigate('dashboard');
    };

    if (!session) return <Login onLogin={signIn}/>;

    let page;
    if (!canAccess(route, session.role)) page = <AccessDenied navigate={navigate}/>;
    // else if (route === 'dashboard') page = <Dashboard navigate={navigate}/>;
    // else if (route === 'products/new') page = <ProductForm navigate={navigate}/>;
    // else if (route.startsWith('products/edit/')) page =
    //     <ProductForm navigate={navigate} productId={route.split('/')[2]}/>;
    // else if (route.startsWith('products/view/')) page = <Products navigate={navigate} viewId={route.split('/')[2]}/>;
    // else if (route.startsWith('products/category/')) page =
    //     <Products navigate={navigate} initialCategory={route.split('/')[2]}/>;
    // else if (route === 'products') page = <Products navigate={navigate}/>;
    // else if (route === 'categories') page = <Categories navigate={navigate}/>;
    // else if (route === 'inventory/alerts') page = <Inventory navigate={navigate} section="alerts"/>;
    // else if (route === 'inventory/history') page = <Inventory navigate={navigate} section="history"/>;
    // else if (route === 'inventory') page = <Inventory navigate={navigate} section="current"/>;
    // else if (route === 'sales/new') page = <NewSale navigate={navigate}/>;
    // else if (route.startsWith('sales/view/')) page =
    //     <Sales navigate={navigate} viewId={decodeURIComponent(route.split('/')[2])}/>;
    // else if (route === 'sales') page = <Sales navigate={navigate}/>;
    // else if (route === 'reports') page = <Reports/>;
    // else if (route === 'users') page = <Users/>;
    // else if (route === 'settings') page = <Settings/>;
    // else if (route === 'profile') page = <Profile/>;
    // else page = <Dashboard navigate={navigate}/>;

    return <Layout route={route} navigate={navigate} onSignOut={logout}>{page}</Layout>;
}