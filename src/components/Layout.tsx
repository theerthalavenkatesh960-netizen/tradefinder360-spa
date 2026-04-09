import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Lightbulb,
  Search,
  TrendingUp,
  Star,
  Briefcase,
  Radar as RadarIcon,
  List,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useMarketStore } from '../store/market';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { sentiment } = useMarketStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Market Insights', href: '/', icon: Lightbulb },
    { name: 'Stocks', href: '/stocks', icon: Search },
    { name: 'Radar', href: '/radar', icon: RadarIcon },
    { name: 'Portfolio', href: '/portfolio', icon: Briefcase },
    { name: 'Recommendations', href: '/recommendations', icon: List },
    { name: 'Watchlist', href: '/watchlist', icon: Star },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getSentimentColor = () => {
    switch (sentiment) {
      case 'BULLISH':
        return 'bg-green-500/10 text-green-400';
      case 'BEARISH':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-yellow-500/10 text-yellow-400';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#12121a]/95 backdrop-blur-lg border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-indigo-500" />
            <span className="text-lg font-bold">TradeFinder360</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div className="flex">
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 fixed lg:sticky top-0 left-0 z-40 w-64 h-screen bg-[#12121a]/50 backdrop-blur-xl border-r border-gray-800/50 transition-transform duration-300 ease-in-out`}
        >
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-500/10 p-2 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-indigo-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">TradeFinder360</h1>
                  <p className="text-xs text-gray-400">Pro Trading Platform</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                      isActive
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-gray-800">
              {sentiment && (
                <div className={`${getSentimentColor()} rounded-lg px-3 py-2 mb-3 text-sm font-medium text-center`}>
                  Market: {sentiment}
                </div>
              )}
              <div className="bg-gray-800/50 rounded-lg p-4 mb-3">
                <p className="text-xs text-gray-400 mb-1">Logged in as</p>
                <p className="text-sm font-medium truncate">{user?.email || 'User'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition w-full"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 mt-16 lg:mt-0">
          <div className="p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
};
