import { useForm } from 'react-hook-form';
import { http } from '@/lib/http';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

type FormValues = { credential: string; password: string };

export function SignIn() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const onSubmit = async (values: FormValues) => {
    try {
      const isEmail = values.credential.includes('@');
      
      if (isEmail) {
        await http('/auth/login-email', {
          method: 'POST',
          body: JSON.stringify({ email: values.credential, password: values.password })
        });
      } else {
        await http('/auth/login-id', {
          method: 'POST',
          body: JSON.stringify({ loginId: values.credential, secret: values.password })
        });
      }
      
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
          <label className="text-sm font-medium">Email ou Identifiant</label>
          <input className="w-full rounded-md border px-3 py-2" type="text" placeholder="admin@example.com ou STU001" {...register('credential', { required: true })} />
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