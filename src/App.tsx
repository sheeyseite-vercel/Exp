import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Icon } from './components/Icon';
import Alerts from './pages/Alerts';
import Details from './pages/Details';
import Home from './pages/Home';
import Login from './pages/Login';
import ProductForm from './pages/ProductForm';
import Products from './pages/Products';
import Profile from './pages/Profile';
import Scan from './pages/Scan';
import { useData } from './state/DataProvider';

function Splash() {
  return (
    <div className="splash" role="status" aria-label="جارٍ التحميل">
      <span className="logo logo-lg">
        <Icon name="calendarCheck" size={34} />
      </span>
    </div>
  );
}

export default function App() {
  const { authReady, session } = useData();
  if (!authReady) return <Splash />;
  if (!session) return <Login />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Products />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="scan" element={<Scan />} />
      <Route path="product/new" element={<ProductForm />} />
      <Route path="product/:id" element={<Details />} />
      <Route path="product/:id/edit" element={<ProductForm />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
