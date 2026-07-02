"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, MessageCircle } from "lucide-react";
import api from "@/lib/api";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Must have uppercase, lowercase, and a number"),
  workspaceName: z.string().min(2, "Workspace name required"),
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
    defaultValues: { workspaceName: inviteToken ? "My Workspace" : undefined },
  });

  useEffect(() => {
    if (!inviteToken) return;
    api.get(`/invitations/${inviteToken}`).then((r) => {
      if (!r.data.expired) setValue("email", r.data.email);
    }).catch(() => {});
  }, [inviteToken, setValue]);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      await api.post("/auth/register", data);
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
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">WAZENLY</span>
        </div>
        <p className="text-slate-400 text-sm">{inviteToken ? "Create your account to accept the invitation" : "Create your free account"}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
            <input {...register("name")} type="text" placeholder="John Smith" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Work Email</label>
            <input {...register("email")} type="email" placeholder="john@company.com" readOnly={!!inviteToken} className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm ${inviteToken ? "bg-gray-50 text-gray-500" : ""}`} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company / Workspace Name</label>
            <input {...register("workspaceName")} type="text" placeholder="Acme Corp" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm" />
            {errors.workspaceName && <p className="text-red-500 text-xs mt-1">{errors.workspaceName.message}</p>}
            {inviteToken && <p className="text-xs text-gray-400 mt-1">You&apos;ll also get your own workspace — you can switch to the one you were invited to after signing in.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 chars, uppercase & number"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</> : "Create free account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href={inviteToken ? `/auth/login?invite=${inviteToken}` : "/auth/login"} className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading…</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
