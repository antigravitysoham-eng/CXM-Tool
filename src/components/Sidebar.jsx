import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useView } from '../context/view';
import {
  LayoutDashboard,
  Wallet,
  FileText,
  FolderOpen,
  Rocket,
  GraduationCap,
  HeartPulse,
  Presentation,
  ClipboardCheck,
  Map,
  LifeBuoy,
  Zap,
  TrendingUp,
  Mail,
  Calendar,
  Settings,
  HelpCircle,
  Gift,
  Sparkles,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const { user } = useAuth();
  const { collapsed, setCollapsed } = useView();
  const canManageAccess = user?.role === 'admin' || user?.role === 'manager';

  const menuGroups = [
    {
      label: 'Main',
      items: [
        { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
        { name: 'Cash Horizon', icon: <Wallet size={20} />, path: '/cash-horizon' },
        { name: 'Agent HQ', icon: <Sparkles size={20} />, path: '/agents' },
      ]
    },
    {
      label: 'Operations',
      items: [
        { name: 'CLM', icon: <FileText size={20} />, path: '/clm' },
        { name: 'Documents', icon: <FolderOpen size={20} />, path: '/documents' },
        { name: 'Onboarding', icon: <Rocket size={20} />, path: '/onboarding' },
        { name: 'Training', icon: <GraduationCap size={20} />, path: '/training' },
        { name: 'Health Checks', icon: <HeartPulse size={20} />, path: '/health-checks' },
        { name: 'EBRs', icon: <Presentation size={20} />, path: '/ebrs' },
      ]
    },
    {
      label: 'Insights & Feedback',
      items: [
        { name: 'Surveys', icon: <ClipboardCheck size={20} />, path: '/surveys' },
        { name: 'Journey Map', icon: <Map size={20} />, path: '/journey' },
        { name: 'Support Metrics', icon: <LifeBuoy size={20} />, path: '/support' },
        { name: 'Feature Requests', icon: <Zap size={20} />, path: '/feature-requests' },
      ]
    },
    {
      label: 'Growth & Marketing',
      items: [
        { name: 'Upsells', icon: <TrendingUp size={20} />, path: '/upsells' },
        { name: 'Communications', icon: <Mail size={20} />, path: '/comms' },
        { name: 'Events', icon: <Calendar size={20} />, path: '/events' },
        { name: 'Referrals', icon: <Gift size={20} />, path: '/referrals' },
      ]
    }
  ];

  const footer = [
    ...(canManageAccess ? [{ name: 'Access & Users', icon: <ShieldCheck size={20} />, path: '/users' }] : []),
    { name: 'Connectivity Hub', icon: <Settings size={20} />, path: '/connectivity' }
  ];

  // Collapsed, the label is gone — the native tooltip is what's left to name it.
  const linkTitle = (name) => (collapsed ? name : undefined);

  return (
    <div className={`sidebar glass ${collapsed ? 'is-collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand modules' : 'Collapse to icons'}
        aria-label={collapsed ? 'Expand modules' : 'Collapse to icons'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
      </button>

      <div className="sidebar-logo">
        <div className="sidebar-mark">A</div>
        {!collapsed && <h2 className="sidebar-brand">AG<span className="gradient-text">CX</span></h2>}
      </div>

      <nav className="sidebar-nav">
        {menuGroups.map((group) => (
          <div className="sidebar-group" key={group.label}>
            <p className="sidebar-group-label">{group.label}</p>
            <div className="sidebar-items">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  title={linkTitle(item.name)}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  <span className="sidebar-text">{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {footer.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={linkTitle(item.name)}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-text">{item.name}</span>
          </NavLink>
        ))}
        <button className="sidebar-link" title={linkTitle('Help Center')}>
          <span className="sidebar-icon"><HelpCircle size={20} /></span>
          <span className="sidebar-text">Help Center</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
