import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { PlacesList } from './pages/PlacesList';
import { PlaceEditor } from './pages/PlaceEditor';
import { DestinationsList } from './pages/DestinationsList';
import { ItinerariesList } from './pages/ItinerariesList';
import { MediaLibrary } from './pages/MediaLibrary';
import { Place } from '@localdepth/shared-types';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [editingPlace, setEditingPlace] = useState<{ active: boolean; place: Place | null }>({
    active: false,
    place: null,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm">
        <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3"></span>
        Cargando LocalDepth Admin...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleEditPlace = (place: Place | null) => {
    setEditingPlace({ active: true, place });
  };

  const handleClosePlaceEditor = () => {
    setEditingPlace({ active: false, place: null });
  };

  const getPageTitle = () => {
    if (editingPlace.active) return editingPlace.place ? 'Editar Lugar' : 'Nuevo Lugar';
    switch (currentTab) {
      case 'dashboard':
        return 'Panel Principal';
      case 'places':
        return 'Gestión de Lugares & Leaflet';
      case 'destinations':
        return 'Destinos Editoriales';
      case 'itineraries':
        return 'Itinerarios y Rutas';
      case 'media':
        return 'Biblioteca Multimedia MinIO';
      default:
        return 'LocalDepth Studio';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setEditingPlace({ active: false, place: null });
          setCurrentTab(tab);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar title={getPageTitle()} />

        <main className="flex-1 overflow-y-auto">
          {editingPlace.active ? (
            <PlaceEditor
              place={editingPlace.place}
              onSave={handleClosePlaceEditor}
              onCancel={handleClosePlaceEditor}
            />
          ) : (
            <>
              {currentTab === 'dashboard' && <Dashboard onNavigate={setCurrentTab} />}
              {currentTab === 'places' && <PlacesList onEditPlace={handleEditPlace} />}
              {currentTab === 'destinations' && <DestinationsList />}
              {currentTab === 'itineraries' && <ItinerariesList />}
              {currentTab === 'media' && <MediaLibrary />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
