"use client";

import { NextUIProvider } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ToastContainer } = useToast();

  return (
    <NextUIProvider navigate={(href) => router.push(href)}>
      {children}
      <ToastContainer />
    </NextUIProvider>
  );
}
