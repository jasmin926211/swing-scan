import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create account — CandleTrade" };

export default function Page() {
  // AuthForm reads ?next= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
