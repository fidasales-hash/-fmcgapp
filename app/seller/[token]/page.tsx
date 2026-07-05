import SellerDashboardClient from './SellerDashboardClient';

export default async function SellerDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SellerDashboardClient token={token} />;
}
