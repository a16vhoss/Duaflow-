'use client';

import { RoleLayout } from '@/components/role-layout';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout>{children}</RoleLayout>;
}
