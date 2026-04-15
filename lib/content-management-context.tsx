import React, { createContext, useContext, useState, useCallback } from 'react';

export interface AppContent {
  appName: string;
  appTagline: string;
  appDescription: string;
  supportPhone: string;
  supportEmail: string;
  whatsappLink: string;
  whatsappGroup: string;
  whatsappChannel: string;
  emergencyPhone: string;
  paymentPhone: string;
  merchantCode: string;
  ussdCode: string;
  aboutText: string;
  termsText: string;
  privacyText: string;
}

export interface AppSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  appLogo: string;
  appFavicon: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  appVersion: string;
  minAppVersion: string;
  forceUpdate: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

export interface SMSTemplate {
  id: string;
  name: string;
  message: string;
  variables: string[];
  isActive: boolean;
  maxLength: number;
}

export interface PushTemplate {
  id: string;
  name: string;
  title: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetRoles: string[];
}

interface ContentManagementContextType {
  appContent: AppContent;
  appSettings: AppSettings;
  emailTemplates: EmailTemplate[];
  smsTemplates: SMSTemplate[];
  pushTemplates: PushTemplate[];
  featureFlags: FeatureFlag[];
  
  // Content management
  updateAppContent: (content: Partial<AppContent>) => void;
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  
  // Email templates
  addEmailTemplate: (template: EmailTemplate) => void;
  updateEmailTemplate: (id: string, template: Partial<EmailTemplate>) => void;
  deleteEmailTemplate: (id: string) => void;
  getEmailTemplate: (id: string) => EmailTemplate | undefined;
  
  // SMS templates
  addSMSTemplate: (template: SMSTemplate) => void;
  updateSMSTemplate: (id: string, template: Partial<SMSTemplate>) => void;
  deleteSMSTemplate: (id: string) => void;
  getSMSTemplate: (id: string) => SMSTemplate | undefined;
  
  // Push templates
  addPushTemplate: (template: PushTemplate) => void;
  updatePushTemplate: (id: string, template: Partial<PushTemplate>) => void;
  deletePushTemplate: (id: string) => void;
  getPushTemplate: (id: string) => PushTemplate | undefined;
  
  // Feature flags
  addFeatureFlag: (flag: FeatureFlag) => void;
  updateFeatureFlag: (id: string, flag: Partial<FeatureFlag>) => void;
  deleteFeatureFlag: (id: string) => void;
  isFeatureEnabled: (flagId: string, userRole?: string) => boolean;
  
  // Backup & Restore
  exportAllContent: () => string;
  importAllContent: (data: string) => boolean;
}

const defaultAppContent: AppContent = {
  appName: 'LTC FAST TRACK',
  appTagline: 'Fast & Efficient Garbage Collection',
  appDescription: 'Fast and efficient garbage collection services for residential and commercial properties across Zambia.',
  supportPhone: '+260960500656',
  supportEmail: 'support@ltcfasttrack.co.zm',
  whatsappLink: 'https://wa.me/260960500656',
  whatsappGroup: 'https://chat.whatsapp.com/group',
  whatsappChannel: 'https://whatsapp.com/channel/0029VbBI2c16hENx0dnt593o',
  emergencyPhone: '+260960500656',
  paymentPhone: '0960819993',
  merchantCode: '58939299',
  ussdCode: '*4466#',
  aboutText: 'LTC FAST TRACK is Zambia\'s leading garbage collection service provider.',
  termsText: 'Terms and conditions apply.',
  privacyText: 'Your privacy is important to us.',
};

const defaultAppSettings: AppSettings = {
  primaryColor: '#22C55E',
  secondaryColor: '#0a7ea4',
  accentColor: '#EF4444',
  backgroundColor: '#ffffff',
  textColor: '#11181C',
  appLogo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663275322468/hAypGdcHXnZQysIi.png',
  appFavicon: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663275322468/hAypGdcHXnZQysIi.png',
  maintenanceMode: false,
  maintenanceMessage: 'We are currently under maintenance. Please try again later.',
  appVersion: '1.0.0',
  minAppVersion: '1.0.0',
  forceUpdate: false,
};

const ContentManagementContext = createContext<ContentManagementContextType | undefined>(undefined);

export function ContentManagementProvider({ children }: { children: React.ReactNode }) {
  const [appContent, setAppContent] = useState<AppContent>(defaultAppContent);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([
    {
      id: 'welcome',
      name: 'Welcome Email',
      subject: 'Welcome to {{appName}}',
      body: 'Hello {{userName}},\n\nWelcome to {{appName}}! We\'re excited to have you on board.',
      variables: ['appName', 'userName'],
      isActive: true,
    },
    {
      id: 'payment-confirmation',
      name: 'Payment Confirmation',
      subject: 'Payment Confirmed - {{amount}}',
      body: 'Your payment of {{amount}} has been confirmed. Transaction ID: {{transactionId}}',
      variables: ['amount', 'transactionId'],
      isActive: true,
    },
  ]);
  const [smsTemplates, setSMSTemplates] = useState<SMSTemplate[]>([
    {
      id: 'pickup-reminder',
      name: 'Pickup Reminder',
      message: 'Hi {{userName}}, your pickup is scheduled for {{date}} at {{time}}. Confirm by replying YES.',
      variables: ['userName', 'date', 'time'],
      isActive: true,
      maxLength: 160,
    },
    {
      id: 'payment-alert',
      name: 'Payment Alert',
      message: 'Your subscription payment of {{amount}} is due on {{date}}. Pay now to avoid service interruption.',
      variables: ['amount', 'date'],
      isActive: true,
      maxLength: 160,
    },
  ]);
  const [pushTemplates, setPushTemplates] = useState<PushTemplate[]>([
    {
      id: 'new-pickup',
      name: 'New Pickup Available',
      title: 'New Pickup Request',
      body: 'A new pickup is available at {{location}}. Tap to accept.',
      variables: ['location'],
      isActive: true,
    },
    {
      id: 'pickup-completed',
      name: 'Pickup Completed',
      title: 'Pickup Completed',
      body: 'Your pickup has been completed. Thank you for using {{appName}}!',
      variables: ['appName'],
      isActive: true,
    },
  ]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([
    {
      id: 'new-dashboard',
      name: 'New Dashboard',
      description: 'Enable new dashboard design',
      enabled: true,
      rolloutPercentage: 100,
      targetRoles: ['customer', 'collector', 'recycler'],
    },
    {
      id: 'biometric-login',
      name: 'Biometric Login',
      description: 'Enable Face ID/Fingerprint login',
      enabled: true,
      rolloutPercentage: 100,
      targetRoles: ['customer', 'collector'],
    },
  ]);

  const updateAppContent = useCallback((content: Partial<AppContent>) => {
    setAppContent(prev => ({ ...prev, ...content }));
  }, []);

  const updateAppSettings = useCallback((settings: Partial<AppSettings>) => {
    setAppSettings(prev => ({ ...prev, ...settings }));
  }, []);

  // Email template management
  const addEmailTemplate = useCallback((template: EmailTemplate) => {
    setEmailTemplates(prev => [...prev, template]);
  }, []);

  const updateEmailTemplate = useCallback((id: string, template: Partial<EmailTemplate>) => {
    setEmailTemplates(prev =>
      prev.map(t => (t.id === id ? { ...t, ...template } : t))
    );
  }, []);

  const deleteEmailTemplate = useCallback((id: string) => {
    setEmailTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const getEmailTemplate = useCallback((id: string) => {
    return emailTemplates.find(t => t.id === id);
  }, [emailTemplates]);

  // SMS template management
  const addSMSTemplate = useCallback((template: SMSTemplate) => {
    setSMSTemplates(prev => [...prev, template]);
  }, []);

  const updateSMSTemplate = useCallback((id: string, template: Partial<SMSTemplate>) => {
    setSMSTemplates(prev =>
      prev.map(t => (t.id === id ? { ...t, ...template } : t))
    );
  }, []);

  const deleteSMSTemplate = useCallback((id: string) => {
    setSMSTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const getSMSTemplate = useCallback((id: string) => {
    return smsTemplates.find(t => t.id === id);
  }, [smsTemplates]);

  // Push template management
  const addPushTemplate = useCallback((template: PushTemplate) => {
    setPushTemplates(prev => [...prev, template]);
  }, []);

  const updatePushTemplate = useCallback((id: string, template: Partial<PushTemplate>) => {
    setPushTemplates(prev =>
      prev.map(t => (t.id === id ? { ...t, ...template } : t))
    );
  }, []);

  const deletePushTemplate = useCallback((id: string) => {
    setPushTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const getPushTemplate = useCallback((id: string) => {
    return pushTemplates.find(t => t.id === id);
  }, [pushTemplates]);

  // Feature flag management
  const addFeatureFlag = useCallback((flag: FeatureFlag) => {
    setFeatureFlags(prev => [...prev, flag]);
  }, []);

  const updateFeatureFlag = useCallback((id: string, flag: Partial<FeatureFlag>) => {
    setFeatureFlags(prev =>
      prev.map(f => (f.id === id ? { ...f, ...flag } : f))
    );
  }, []);

  const deleteFeatureFlag = useCallback((id: string) => {
    setFeatureFlags(prev => prev.filter(f => f.id !== id));
  }, []);

  const isFeatureEnabled = useCallback((flagId: string, userRole?: string) => {
    const flag = featureFlags.find(f => f.id === flagId);
    if (!flag || !flag.enabled) return false;
    
    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const random = Math.random() * 100;
      if (random > flag.rolloutPercentage) return false;
    }
    
    // Check role targeting
    if (userRole && flag.targetRoles.length > 0) {
      return flag.targetRoles.includes(userRole);
    }
    
    return true;
  }, [featureFlags]);

  // Backup and restore
  const exportAllContent = useCallback(() => {
    const backup = {
      appContent,
      appSettings,
      emailTemplates,
      smsTemplates,
      pushTemplates,
      featureFlags,
      exportDate: new Date().toISOString(),
    };
    return JSON.stringify(backup, null, 2);
  }, [appContent, appSettings, emailTemplates, smsTemplates, pushTemplates, featureFlags]);

  const importAllContent = useCallback((data: string) => {
    try {
      const backup = JSON.parse(data);
      if (backup.appContent) setAppContent(backup.appContent);
      if (backup.appSettings) setAppSettings(backup.appSettings);
      if (backup.emailTemplates) setEmailTemplates(backup.emailTemplates);
      if (backup.smsTemplates) setSMSTemplates(backup.smsTemplates);
      if (backup.pushTemplates) setPushTemplates(backup.pushTemplates);
      if (backup.featureFlags) setFeatureFlags(backup.featureFlags);
      return true;
    } catch (error) {
      console.error('Failed to import content:', error);
      return false;
    }
  }, []);

  const value: ContentManagementContextType = {
    appContent,
    appSettings,
    emailTemplates,
    smsTemplates,
    pushTemplates,
    featureFlags,
    updateAppContent,
    updateAppSettings,
    addEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    getEmailTemplate,
    addSMSTemplate,
    updateSMSTemplate,
    deleteSMSTemplate,
    getSMSTemplate,
    addPushTemplate,
    updatePushTemplate,
    deletePushTemplate,
    getPushTemplate,
    addFeatureFlag,
    updateFeatureFlag,
    deleteFeatureFlag,
    isFeatureEnabled,
    exportAllContent,
    importAllContent,
  };

  return (
    <ContentManagementContext.Provider value={value}>
      {children}
    </ContentManagementContext.Provider>
  );
}

export function useContentManagement() {
  const context = useContext(ContentManagementContext);
  if (!context) {
    throw new Error('useContentManagement must be used within ContentManagementProvider');
  }
  return context;
}
