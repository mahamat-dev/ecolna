import { useForm } from 'react-hook-form';
import { post } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

type FormValues = { email: string; password: string };

export function SignIn() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const onSubmit = async (values: FormValues) => {
    try {
      await post('auth/login-email', values);
      // Invalidate the 'me' query to refresh authentication state
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Connecté');
      navigate('/');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center">Se connecter</h1>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <input className="w-full rounded-md border px-3 py-2" type="email" {...register('email', { required: true })} />
          </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Mot de passe</label>
          <input className="w-full rounded-md border px-3 py-2" type="password" {...register('password', { required: true })} />
        </div>
        <button disabled={isSubmitting} className="w-full rounded-md bg-primary text-primary-foreground h-10">
          {isSubmitting ? '...' : 'Connexion'}
        </button>
      </form>
    </div>
  );
}