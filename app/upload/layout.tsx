import AdminNav from '@/components/AdminNav';

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
