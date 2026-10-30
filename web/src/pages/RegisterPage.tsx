import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { ApiError } from '../api/client';
import { api } from '../api/endpoints';
import { signIn } from '../auth/session';
import { Alert, Button, Input, PasswordInput } from '../components/ui';
import { useToast } from '../components/toast';
import { errorMessage } from '../lib/errors';
import { registerSchema, type RegisterForm } from '../lib/schemas';
import { AuthAlternative, AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  // Creates the account and logs in right away
  const signUp = useMutation({
    mutationFn: async ({ name, email, password }: RegisterForm) => {
      await api.register({ name, email, password });
      const { token } = await api.login({ email, password });
      return { token, email: email.trim().toLowerCase() };
    },
    onSuccess: (session, { name }) => {
      signIn(session);
      toast({
        tone: 'success',
        title: `Bem-vindo, ${name.trim().split(' ')[0]}!`,
        description: 'Sua conta foi criada.',
      });
      navigate('/', { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'CONFLICT') {
        setError('email', { message: 'Este e-mail já está cadastrado' });
      }
    },
  });

  const conflict = signUp.error instanceof ApiError && signUp.error.code === 'CONFLICT';

  return (
    <AuthLayout title="Criar conta" subtitle="Leva menos de um minuto.">
      <form
        noValidate
        className="space-y-4 [@media(max-height:820px)]:space-y-3"
        onSubmit={handleSubmit((data) => signUp.mutate(data))}
      >
        {signUp.isError && !conflict && <Alert>{errorMessage(signUp.error)}</Alert>}
        <Input
          label="Nome"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Senha"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres"
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput
          label="Confirmar senha"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="lg" className="mt-2 w-full" loading={signUp.isPending}>
          Criar conta
        </Button>
      </form>
      <AuthAlternative question="Já tem conta?" to="/login" label="Entrar" />
    </AuthLayout>
  );
}
