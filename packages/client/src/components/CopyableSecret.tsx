import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff } from 'lucide-react';

interface CopyableSecretProps {
  value: string;
  label: string;
  description?: string;
  variant?: 'default' | 'warning';
}

export function CopyableSecret({
  value,
  label,
  description,
  variant = 'default'
}: CopyableSecretProps) {
  const [isVisible, setIsVisible] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
    toast.success('Copié dans le presse-papiers');
  };

  const containerClass = variant === 'warning'
    ? 'bg-yellow-50 border border-yellow-200 rounded p-4'
    : 'bg-gray-50 border border-gray-200 rounded p-4';

  const labelClass = variant === 'warning'
    ? 'text-sm font-medium text-yellow-800'
    : 'text-sm font-medium text-gray-700';

  const descriptionClass = variant === 'warning'
    ? 'text-xs text-yellow-700 mb-2'
    : 'text-xs text-gray-600 mb-2';

  const inputClass = variant === 'warning'
    ? 'bg-yellow-100 px-3 py-2 rounded flex-1 font-mono text-sm'
    : 'bg-white px-3 py-2 rounded flex-1 font-mono text-sm border border-gray-300';

  return (
    <div className={containerClass}>
      <label className={labelClass}>{label}</label>
      {description && (
        <p className={descriptionClass}>{description}</p>
      )}
      <div className="flex items-center gap-2 mt-2">
        <input
          type={isVisible ? 'text' : 'password'}
          value={value}
          readOnly
          className={inputClass}
        />
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
          title={isVisible ? 'Masquer' : 'Afficher'}
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          onClick={copyToClipboard}
          className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Copier"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}