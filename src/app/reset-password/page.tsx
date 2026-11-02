import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password — CandleTrend" };

export default function Page() {
  return <ResetPasswordForm />;
}
