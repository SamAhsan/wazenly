"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import api from "@/lib/api";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Must have uppercase, lowercase, and a number"),
});
type FormData = z.infer<typeof schema>;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Wazenly has no public self-registration -- an account can only be created
  // as part of accepting a team invitation, never by visiting this page directly.
  useEffect(() => {
    if (!inviteToken) router.replace("/auth/login");
  }, [inviteToken, router]);

  useEffect(() => {
    if (!inviteToken) return;
    api.get(`/invitations/${inviteToken}`).then((r) => {
      if (!r.data.expired) setValue("email", r.data.email);
    }).catch(() => {});
  }, [inviteToken, setValue]);

  if (!inviteToken) return null;

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      await api.post("/auth/register", { ...data, inviteToken: inviteToken || undefined });
      toast.success("Account created! Check your email to verify your account.");
      router.push(inviteToken ? `/auth/login?invite=${inviteToken}` : "/auth/login");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <Image src="/logo-mark.png" alt="Wazenly" width={40} height={40} />
          <span className="text-2xl font-bold text-white tracking-tight">WAZENLY</span>
        </div>
        <p className="text-slate-400 text-sm">Create your account to accept the invitation</p>
      </div>

      <div className="neu-card p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
            <input {...register("name")} type="text" placeholder="John Smith" className="neu-input w-full px-4 py-3 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Work Email</label>
            <input {...register("email")} type="email" placeholder="john@company.com" readOnly className="neu-input w-full px-4 py-3 text-sm border-0 text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 chars, uppercase & number"
                className="neu-input w-full px-4 py-3 pr-10 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-600 text-white font-semibold py-3 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25 disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href={`/auth/login?invite=${inviteToken}`} className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading…</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
