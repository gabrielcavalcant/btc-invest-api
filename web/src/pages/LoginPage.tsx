import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { api } from '../api/endpoints';
import { signIn, takeSignOutReason } from '../auth/session';
import { Alert, Button, Input, PasswordInput } from '../components/ui';
import { errorMessage } from '../lib/errors';
import { loginSchema, type LoginForm } from '../lib/schemas';
import { AuthAlternative, AuthLayout } from './AuthLayout';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [signOutReason] = useState(takeSignOutReason);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const login = useMutation({
    mutationFn: api.login,
    onSuccess: ({ token }, { email }) => {
      signIn({ token, email: email.trim().toLowerCase() });
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/', { replace: true });
    },
  });

  return (
    <AuthLayout title="Entrar" subtitle="Acesse sua conta para investir em Bitcoin.">
      <form
        noValidate
        className="space-y-4 [@media(max-height:820px)]:space-y-3"
        onSubmit={handleSubmit((data) => login.mutate(data))}
      >
        {signOutReason === 'expired' && !login.isError && (
          <Alert tone="info">Sua sessão expirou. Entre novamente.</Alert>
        )}
        {login.isError && <Alert>{errorMessage(login.error)}</Alert>}
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Senha"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" size="lg" className="mt-2 w-full" loading={login.isPending}>
          Entrar
        </Button>
      </form>
      <AuthAlternative
        question="Ainda não tem conta?"
        to="/cadastro"
        label="Criar conta"
        prominent
      />
    </AuthLayout>
  );
}
