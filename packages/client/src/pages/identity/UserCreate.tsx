import { useForm } from 'react-hook-form';
import { post } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';

type FormValues = {
  role: 'ADMIN' | 'TEACHER' | 'STAFF' | 'STUDENT' | 'GUARDIAN';
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  password?: string;
};

type CreateUserResponse = {
  userId: string;
  profileId: string;
  loginId?: string;
  newSecret?: string;
  email?: string;
};

export function UserCreate() {
  const { register, handleSubmit, watch, formState: { isSubmitting, errors } } = useForm<FormValues>({
    defaultValues: { role: 'STUDENT' }
  });
  const navigate = useNavigate();
  const [createdUser, setCreatedUser] = useState<CreateUserResponse | null>(null);
  
  const selectedRole = watch('role');
  const isAdmin = selectedRole === 'ADMIN';

  const onSubmit = async (values: FormValues) => {
    try {
      const response = await post<CreateUserResponse>('admin/users', values);
      setCreatedUser(response);
      toast.success('Utilisateur créé avec succès');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papiers');
  };

  if (createdUser) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-semibold text-green-600 mb-4">✅ Utilisateur créé</h1>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">ID Utilisateur</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="bg-gray-100 px-3 py-2 rounded flex-1">{createdUser.userId}</code>
                <button 
                  onClick={() => copyToClipboard(createdUser.userId)}
                  className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Copier
                </button>
              </div>
            </div>

            {createdUser.email && (
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-gray-100 px-3 py-2 rounded flex-1">{createdUser.email}</code>
                  <button 
                    onClick={() => copyToClipboard(createdUser.email!)}
                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Copier
                  </button>
                </div>
              </div>
            )}

            {createdUser.loginId && (
              <div>
                <label className="text-sm font-medium text-gray-600">Login ID</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-gray-100 px-3 py-2 rounded flex-1">{createdUser.loginId}</code>
                  <button 
                    onClick={() => copyToClipboard(createdUser.loginId!)}
                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Copier
                  </button>
                </div>
              </div>
            )}

            {createdUser.newSecret && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <label className="text-sm font-medium text-yellow-800">Secret temporaire</label>
                <p className="text-xs text-yellow-700 mb-2">⚠️ Notez ce secret - il ne sera plus affiché</p>
                <div className="flex items-center gap-2">
                  <code className="bg-yellow-100 px-3 py-2 rounded flex-1 font-mono">{createdUser.newSecret}</code>
                  <button 
                    onClick={() => copyToClipboard(createdUser.newSecret!)}
                    className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                  >
                    Copier
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button 
              onClick={() => navigate('/identity/users')}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Voir tous les utilisateurs
            </button>
            <button 
              onClick={() => setCreatedUser(null)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Créer un autre utilisateur
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold mb-6">Créer un utilisateur</h1>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rôle</label>
            <select 
              {...register('role', { required: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="STUDENT">Étudiant</option>
              <option value="TEACHER">Enseignant</option>
              <option value="STAFF">Personnel</option>
              <option value="GUARDIAN">Parent/Tuteur</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prénom *</label>
              <input 
                type="text"
                {...register('firstName', { required: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom *</label>
              <input 
                type="text"
                {...register('lastName', { required: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
            <input 
              type="tel"
              {...register('phone')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <input 
                type="email"
                {...register('email', { required: isAdmin })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe *
            </label>
            <input 
              type="password"
              {...register('password', { 
                required: 'Le mot de passe est requis',
                minLength: {
                  value: isAdmin ? 8 : 6,
                  message: `Le mot de passe doit contenir au moins ${isAdmin ? 8 : 6} caractères`
                }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Minimum ${isAdmin ? 8 : 6} caractères`}
            />
            <p className="text-xs text-gray-500 mt-1">
               {isAdmin 
                 ? "Minimum 8 caractères pour les administrateurs"
                 : "Minimum 6 caractères pour les utilisateurs non-administrateurs"
               }
             </p>
             {errors.password && (
               <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
             )}
           </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <h3 className="font-medium text-blue-900 mb-2">Information</h3>
            <p className="text-sm text-blue-800">
              {isAdmin 
                ? "Les administrateurs utilisent email + mot de passe (min. 8 caractères) pour se connecter."
                : "Un Login ID sera généré automatiquement. Le mot de passe fourni (min. 6 caractères) sera utilisé pour la connexion."}
            </p>
          </div>

          <div className="flex gap-3">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Création...' : 'Créer l\'utilisateur'}
            </button>
            <button 
              type="button"
              onClick={() => navigate('/identity/users')}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}