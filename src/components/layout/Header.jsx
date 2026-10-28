import NotificationBell from '../catalog/NotificationBell.jsx';
import Icon from './Icons.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import '../../pages/styles/Profile.css';
export default function Header({user,exit,menuOpen,onToggleMenu,menuButtonRef,onOpenProfile,onOpenInbox,onOpenTrip,onNotificationCount}) {
 return <header className="app-header">
   <button ref={menuButtonRef} type="button" className="header-menu" onClick={onToggleMenu} aria-label={menuOpen?'Cerrar menú':'Abrir menú'} aria-expanded={menuOpen} aria-controls="app-navigation"><Icon name={menuOpen?'cerrar':'menu'} size={23}/></button>
   <div className="header-brand"><img src="/logo.png" alt=""/><div><strong>GUAYACA</strong><small>Transport</small></div></div>
   <div className="header-user"><NotificationBell user={user} onOpenInbox={onOpenInbox} onOpenTrip={onOpenTrip} onCount={onNotificationCount}/><button type="button" className="header-profile" onClick={onOpenProfile} aria-label="Abrir mi perfil" title="Mi perfil"><UserAvatar user={user}/><span className="header-user-name">{user.name}</span></button><button type="button" onClick={exit} className="header-logout" aria-label="Cerrar sesión"><Icon name="salir" size={19}/><span>Salir</span></button></div>
 </header>;
}
