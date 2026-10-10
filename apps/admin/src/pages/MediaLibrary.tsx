import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { MediaFile } from '@localdepth/shared-types';

export const MediaLibrary: React.FC = () => {
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [altText, setAltText] = useState('');
  const [uploadUrl, setUploadUrl] = useState('');

  const loadMedia = async () => {
    setLoading(true);
    try {
      const res = await api.getMedia();
      setMedia(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const handleSimulateUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.uploadMedia({
      originalName: `photo-${Date.now()}.jpg`,
      url: uploadUrl || 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?auto=format&fit=crop&w=800&q=80',
      altText,
      mimeType: 'image/jpeg',
      size: 350000,
    });
    setUploadUrl('');
    setAltText('');
    loadMedia();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Biblioteca Multimedia (MinIO / S3)</h2>
          <p className="text-xs text-slate-500">Gestión de fotografías y recursos para lugares y destinos</p>
        </div>
      </div>

      {/* Upload Box */}
      <form onSubmit={handleSimulateUpload} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Añadir Imagen a MinIO S3</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="url"
            value={uploadUrl}
            onChange={(e) => setUploadUrl(e.target.value)}
            placeholder="URL de imagen (ej: Unsplash o S3 URL)..."
            className="text-xs border border-slate-300 rounded-lg px-3 py-2"
          />
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Texto alternativo (alt text SEO)..."
            className="text-xs border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition"
        >
          Guardar Imagen en Media Service
        </button>
      </form>

      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-4 text-center py-12 text-sm text-slate-400">Cargando biblioteca...</div>
        ) : media.length === 0 ? (
          <div className="col-span-4 text-center py-12 text-sm text-slate-500">
            No hay imágenes todavía. Sube una arriba.
          </div>
        ) : (
          media.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <img src={item.url} alt={item.altText || item.filename} className="w-full h-36 object-cover bg-slate-100" />
              <div className="p-3 text-xs space-y-1">
                <span className="font-semibold text-slate-800 truncate block">{item.originalName || item.filename}</span>
                <span className="text-[10px] text-slate-500 block">{(item.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
