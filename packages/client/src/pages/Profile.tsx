import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, patch } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { FormField, Input } from '@/components/FormField';
import { UserCircleIcon, CameraIcon, Save, X, Edit } from 'lucide-react';

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dob?: string;
  photoUrl?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
}

interface User {
  id: string;
  email?: string;
  loginId?: string;
  roles: string[];
}

interface MeResponse {
  user: User;
  profile: Profile | null;
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phone?: string;
  dob?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
}

export function Profile() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: meData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => get<MeResponse>('me'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormData>({
    values: meData?.profile ? {
      firstName: meData.profile.firstName,
      lastName: meData.profile.lastName,
      phone: meData.profile.phone || '',
      dob: meData.profile.dob || '',
      address: meData.profile.address || '',
      city: meData.profile.city || '',
      region: meData.profile.region || '',
      country: meData.profile.country || '',
    } : undefined
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileFormData & { photoUrl?: string }) => {
      if (!meData?.profile?.id) throw new Error('Profile not found');
      return patch(`admin/profiles/${meData.profile.id}`, data);
    },
    onSuccess: () => {
      toast.success('Profil mis à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setIsEditing(false);
      setSelectedImage(null);
      setImagePreview(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour du profil');
    },
  });

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('La taille de l\'image ne doit pas dépasser 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner un fichier image valide');
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    // For now, we'll simulate image upload by converting to base64
    // In a real application, you would upload to a cloud service like AWS S3, Cloudinary, etc.
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      let photoUrl = meData?.profile?.photoUrl;
      
      if (selectedImage) {
        photoUrl = await uploadImage(selectedImage);
      }

      updateProfileMutation.mutate({ ...data, photoUrl });
    } catch {
      toast.error('Erreur lors du téléchargement de l\'image');
    }
  };

  const handleCancelEdit = () => {
    reset();
    setIsEditing(false);
    setSelectedImage(null);
    setImagePreview(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center space-x-6 mb-6">
              <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const user = meData?.user;
  const profile = meData?.profile;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mon Profil</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Gérez vos informations personnelles et vos préférences</p>
      </div>

      {/* User Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Informations du compte</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Email:</span>
            <p className="text-sm text-gray-900 dark:text-white mt-1">{user?.email || '-'}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">ID de connexion:</span>
            <p className="text-sm text-gray-900 dark:text-white mt-1">{user?.loginId || '-'}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Rôles:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {user?.roles.map((role) => (
                <span key={role} className="inline-flex px-2 py-1 bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400 text-xs font-medium rounded-full">
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profil Personnel</h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors duration-200"
            >
              <Edit className="h-4 w-4" />
              Modifier
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={updateProfileMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-success-600 hover:bg-success-700 disabled:bg-success-400 text-white font-medium rounded-xl transition-colors duration-200 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {updateProfileMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={updateProfileMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-medium rounded-xl transition-colors duration-200 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Picture Upload */}
            <div className="flex items-center space-x-6">
              <div className="relative">
                {imagePreview || profile?.photoUrl ? (
                  <img
                    src={imagePreview || profile?.photoUrl}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-600"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-4 border-gray-200 dark:border-gray-600">
                    <UserCircleIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg transition-colors duration-200"
                >
                  <CameraIcon className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Photo de profil</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Cliquez sur l'icône de l'appareil photo pour changer votre photo
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  JPG, PNG ou GIF. Taille maximale: 5MB
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Prénom" required error={errors.firstName?.message}>
                <Input
                  {...register('firstName', { required: 'Le prénom est requis' })}
                  error={!!errors.firstName}
                />
              </FormField>
              <FormField label="Nom" required error={errors.lastName?.message}>
                <Input
                  {...register('lastName', { required: 'Le nom est requis' })}
                  error={!!errors.lastName}
                />
              </FormField>
              <FormField label="Téléphone" error={errors.phone?.message}>
                <Input
                  {...register('phone')}
                  error={!!errors.phone}
                />
              </FormField>
              <FormField label="Date de naissance" error={errors.dob?.message}>
                <Input
                  type="date"
                  {...register('dob')}
                  error={!!errors.dob}
                />
              </FormField>
              <FormField label="Adresse" error={errors.address?.message}>
                <Input
                  {...register('address')}
                  error={!!errors.address}
                />
              </FormField>
              <FormField label="Ville" error={errors.city?.message}>
                <Input
                  {...register('city')}
                  error={!!errors.city}
                />
              </FormField>
              <FormField label="Région" error={errors.region?.message}>
                <Input
                  {...register('region')}
                  error={!!errors.region}
                />
              </FormField>
              <FormField label="Pays" error={errors.country?.message}>
                <Input
                  {...register('country')}
                  error={!!errors.country}
                />
              </FormField>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Profile Picture Display */}
            <div className="flex items-center space-x-6">
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-600"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-4 border-gray-200 dark:border-gray-600">
                  <UserCircleIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {profile?.firstName} {profile?.lastName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {user?.roles.join(', ')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Prénom:</span>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{profile?.firstName || '-'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Nom:</span>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{profile?.lastName || '-'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Téléphone:</span>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{profile?.phone || '-'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Date de naissance:</span>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{profile?.dob || '-'}</p>
              </div>
              <div className="md:col-span-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Adresse:</span>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{profile?.address || '-'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ville:</span>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{profile?.city || '-'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Région:</span>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{profile?.region || '-'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Pays:</span>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{profile?.country || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;