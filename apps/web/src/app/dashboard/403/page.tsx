"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center max-w-md">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Access denied</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your role doesn&apos;t have permission to view this page. Contact a workspace owner or admin if you think this is a mistake.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
