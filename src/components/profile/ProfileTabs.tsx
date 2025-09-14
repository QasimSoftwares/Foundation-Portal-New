'use client';

import { useState, useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PersonalInfoTab } from './PersonalInfoTab';
import { AddressTab } from './AddressTab';
import { EmergencyContactTab } from './EmergencyContactTab';
import { SkillsTab } from './SkillsTab';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ProfileFormValues, TabConfig } from './types';
import { useUser } from '@/hooks/use-user';
import { User } from '@supabase/supabase-js';
import { FormProvider } from 'react-hook-form';
import { Loader2 } from 'lucide-react';

const tabConfigs: TabConfig[] = [
  {
    id: 'personal-info',
    label: 'Personal Information',
    component: PersonalInfoTab,
  },
  {
    id: 'address',
    label: 'Address',
    component: AddressTab,
  },
  {
    id: 'emergency-contact',
    label: 'Emergency Contact',
    component: EmergencyContactTab,
  },
  {
    id: 'skills',
    label: 'Skills',
    component: SkillsTab,
  },
];

interface ProfileTabsProps {
  form: UseFormReturn<ProfileFormValues>;
  isSubmitting: boolean;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
}

export function ProfileTabs({ form, isSubmitting, onSubmit }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState('personal-info');
  const router = useRouter();
  const { user } = useUser() as { user: User & { role?: string } };
  const [visibleTabs, setVisibleTabs] = useState<TabConfig[]>([]);

  // Filter tabs based on user role when user data is available
  useEffect(() => {
    if (user) {
      const visible = tabConfigs.filter(tab => {
        // If no roles are specified, show the tab to everyone
        if (!tab.roles) return true;
        // Otherwise, check if user has any of the required roles
        return tab.roles.some(role => user.role === role);
      });
      setVisibleTabs(visible);
      
      // If current active tab is not in visible tabs, switch to the first visible tab
      if (!visible.some(tab => tab.id === activeTab) && visible.length > 0) {
        setActiveTab(visible[0].id);
      }
    }
  }, [user, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveTab(tabId);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs 
        value={activeTab} 
        onValueChange={handleTabChange}
        className="space-y-4"
        variant="outline"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          {visibleTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              isActive={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className="whitespace-nowrap"
              data-state={activeTab === tab.id ? 'active' : 'inactive'}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {visibleTabs.map((tab) => {
              const TabComponent = tab.component;
              return (
                <TabsContent 
                  key={tab.id} 
                  value={tab.id}
                  isActive={activeTab === tab.id}
                  className="space-y-4"
                >
                  <TabComponent form={form} />
                </TabsContent>
              );
            })}
            
            <div className="flex justify-end space-x-4 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </span>
                ) : (
                  <span>Save Changes</span>
                )}
              </Button>
            </div>
          </form>
        </FormProvider>
      </Tabs>
    </div>
  );
}
