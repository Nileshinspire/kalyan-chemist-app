import AdminReferralWallet from "@/components/admin/AdminReferralWallet";
import AdminLayout from "@/components/admin/AdminLayout";
import { Suspense } from "react";
import RouteLoading from "@/components/RouteLoading";

function AdminReferralWalletPageInner() {
  return <AdminReferralWallet />;
}

export default function AdminReferralWalletPage() {
  return (
    <AdminLayout>
      <Suspense fallback={<RouteLoading />}>
        <AdminReferralWalletPageInner />
      </Suspense>
    </AdminLayout>
  );
}
