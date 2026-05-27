'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MonitorRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/scan');
  }, [router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
      <p className="text-gray-500">Ðang chuy?n hu?ng d?n Scan Center...</p>
    </div>
  );
}
