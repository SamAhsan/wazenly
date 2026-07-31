"use client";

import { signOut } from "next-auth/react";
import { Ban } from "lucide-react";

export default function SuspendedPage() {
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center max-w-md">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Ban className="w-7 h-7 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">This account is no longer active</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your company&apos;s access to Wazenly has been suspended. Contact your account administrator for details.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="inline-block bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
