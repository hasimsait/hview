import { FurnitureEntity } from '@core/types/plan';
import { AssetDefinition } from '@core/types/services';
import { useRuntime } from '@ui/context/RuntimeContext';
import { Box,Check,Search,X } from 'lucide-react';
import React,{ useState } from 'react';
import { ReplaceFurniture } from '../../application/commands/FurnitureCommands';

interface AssetReplacementModalProps {
  item?: FurnitureEntity | null;
  isOpen: boolean;
  onClose: () => void;
  mode?: 'replace' | 'add';
  onSelectAsset?: (asset: AssetDefinition) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'bathroom', label: 'Bathroom & Accessories' },
  { id: 'decor', label: 'Decor & Lighting' },
  { id: 'storage', label: 'Storage' },
  { id: 'seating', label: 'Seating' },
  { id: 'table', label: 'Tables' },
  { id: 'bed', label: 'Beds' },
  { id: 'kitchen', label: 'Kitchen' },
];

export const AssetReplacementModal: React.FC<AssetReplacementModalProps> = ({
  item,
  isOpen,
  onClose,
  mode = 'replace',
  onSelectAsset,
}) => {
  const runtime = useRuntime();
  const assetRegistry = runtime.catalog;
  const editor = runtime.editor;

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const allAssets = assetRegistry.all();
  const filteredAssets = allAssets.filter((asset) => {
    const matchesCategory =
      selectedCategory === 'all' || asset.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.description && asset.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      asset.key.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSelectAsset = (asset: AssetDefinition) => {
    if (mode === 'add' || onSelectAsset) {
      onSelectAsset?.(asset);
      onClose();
    } else if (item) {
      editor.execute(new ReplaceFurniture(item.id, asset.key));
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-base">
              {mode === 'add' ? 'Add Asset / Accessory' : 'Replace Asset'}
            </h3>
            <p className="text-xs text-slate-400">
              {mode === 'add' ? (
                'Choose an asset to place onto the active wall in view'
              ) : (
                <>
                  Replacing <span className="text-sky-400 font-medium">{item?.displayName || 'Asset'}</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/60">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search assets (e.g. towel, fan, sconce, bed, sink)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${selectedCategory === cat.id
                  ? 'bg-sky-500 text-white font-medium'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Asset Cards Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
          {filteredAssets.map((asset) => {
            const isCurrent = mode !== 'add' && item && asset.key.toLowerCase() === item.assetKey.toLowerCase();
            return (
              <button
                key={asset.key}
                onClick={() => handleSelectAsset(asset)}
                className={`flex flex-col text-left p-3 rounded-xl border transition-all ${isCurrent
                  ? 'bg-sky-500/10 border-sky-500/50 shadow-md ring-1 ring-sky-500/30'
                  : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
              >
                <div className="w-full h-20 rounded-lg bg-slate-800 flex items-center justify-center mb-2.5 text-slate-400">
                  <Box className="w-8 h-8 opacity-70 text-sky-400" />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    {asset.category}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] text-sky-400 flex items-center gap-0.5 font-medium">
                      <Check className="w-3 h-3" />
                      Current
                    </span>
                  )}
                </div>
                <h4 className="font-medium text-xs text-slate-100 truncate mb-1">
                  {asset.name}
                </h4>
                {asset.description && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {asset.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/60 flex justify-between items-center text-xs text-slate-400">
          <span>{filteredAssets.length} assets available</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
