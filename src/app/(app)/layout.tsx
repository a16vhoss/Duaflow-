import { RoleLayoutWrapper } from '@/components/role-layout';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayoutWrapper>{children}</RoleLayoutWrapper>;
}
