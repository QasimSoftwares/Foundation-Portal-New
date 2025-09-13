"use client";

import Image from 'next/image';
import { RoleSwitcher } from '@/components/roles/RoleSwitcher';
import { DashboardLink } from './DashboardLink';
import { SignOutButton } from '@/components/auth/sign-out-button';

export default function TopNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4">
        {/* Left: Logo + Brand */}
        <DashboardLink className="flex items-center gap-3">
          <div className="relative w-8 h-8 flex items-center">
            <Image 
              src="/logo.png" 
              alt="Family and Fellows Foundation" 
              width={32}
              height={32}
              className="w-full h-auto object-contain"
              priority
              sizes="32px"
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-800">Family and Fellows Foundation</span>
        </DashboardLink>

        {/* Right: Role Switcher + Sign out */}
        <div className="flex items-center gap-4">
          <div className="w-48">
            <RoleSwitcher />
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
