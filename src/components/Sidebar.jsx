import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Handshake, 
  FileText, 
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
  HelpCircle
} from 'lucide-react';

const Sidebar = () => {
  const menuGroups = [
    {
      label: 'Main',
      items: [
        { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
        { name: 'Directory', icon: <Users size={20} />, path: '/directory' },
      ]
    },
    {
      label: 'Operations',
      items: [
        { name: 'CLM', icon: <FileText size={20} />, path: '/clm' },
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
      ]
    }
  ];

  return (
    <div className="sidebar glass" style={{
      width: '280px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      borderRight: '1px solid var(--border-color)',
      padding: '1.5rem',
      overflowY: 'auto',
      zIndex: 100
    }}>
      <div className="logo" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '2.5rem',
        padding: '0 0.5rem'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-glow)'
        }}>
          <span style={{ fontWeight: 800, color: 'white', fontSize: '1.2rem' }}>A</span>
        </div>
        <h2 style={{ fontSize: '1.25rem', letterSpacing: '-0.5px' }}>
          AG<span className="gradient-text">CX</span>
        </h2>
      </div>

      <nav style={{ flex: 1 }}>
        {menuGroups.map((group, idx) => (
          <div key={idx} style={{ marginBottom: '1.5rem' }}>
            <p style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.75rem',
              paddingLeft: '0.75rem'
            }}>{group.label}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {group.items.map((item, idy) => (
                <NavLink 
                  key={idy} 
                  to={item.path}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'var(--transition-fast)',
                    background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    border: '1px solid',
                    borderColor: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent'
                  })}
                >
                  <span style={{ 
                    color: item.path === window.location.pathname ? 'var(--accent-primary)' : 'inherit',
                    display: 'flex'
                  }}>
                    {item.icon}
                  </span>
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer" style={{
        marginTop: 'auto',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <button className="sidebar-link" style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', color: 'var(--text-secondary)' }}>
          <Settings size={20} /> Settings
        </button>
        <button className="sidebar-link" style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', color: 'var(--text-secondary)' }}>
          <HelpCircle size={20} /> Help Center
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
