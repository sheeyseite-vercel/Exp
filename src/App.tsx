import { Navigate, Route, Routes } from 'react-router-dom';
import { LogoGlyph } from './components/LogoGlyph';
import { AppShell } from './components/AppShell';
import Alerts from './pages/Alerts';
import Details from './pages/Details';
import Home from './pages/Home';
import Login from './pages/Login';
import ProductForm from './pages/ProductForm';
import Products from './pages/Products';
import Profile from './pages/Profile';
import Scan from './pages/Scan';
import Shopping from './pages/Shopping';
import { t } from './lib/i18n';
import { useData } from './state/DataProvider';

function Splash() {
  return (
    <div className="splash" role="status" aria-label={t('loading')}>
      <span className="logo logo-lg">
        <LogoGlyph />
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
      <Route path="shopping" element={<Shopping />} />
      <Route path="product/new" element={<ProductForm />} />
      <Route path="product/:id" element={<Details />} />
      <Route path="product/:id/edit" element={<ProductForm />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
