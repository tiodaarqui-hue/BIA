"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ComissoesHojeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/financeiro/comissoes?tab=hoje");
  }, [router]);

  return null;
}
