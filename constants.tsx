
import { ProjectStatus, UserRole } from './types';

export const IMAGES = {
  LOGO: 'https://www.whoon.com/wp-content/uploads/2026/02/Ontwerp-zonder-titel-1-scaled.png',
  PROJECT_1: 'https://www.whoon.com/wp-content/uploads/2026/01/Screenshot-2026-01-21-145235.png',
  
  BASIC_PACK: [
    'https://www.whoon.com/wp-content/uploads/2026/01/image.png',
    'https://www.whoon.com/wp-content/uploads/2026/01/image.jpg',
    'https://www.whoon.com/wp-content/uploads/2026/01/image-1.png'
  ],
  MODERN_PACK: [
    'https://www.whoon.com/wp-content/uploads/2026/01/Untitled-1.jpg'
  ],
  LUXE_PACK: [
    'https://www.whoon.com/wp-content/uploads/2026/01/botanic.png'
  ]
};

// no mock projects; will be created in Supabase if needed
export const MOCK_PROJECTS: any[] = [];

// no mock packages
export const MOCK_PACKAGES: any[] = [];

const now = new Date();
const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString();
const currentMonth = now.toISOString();

// only the super-admin account remains in mocks
export const MOCK_USERS = [
  { 
    id: 'u-melvin', 
    email: 'melvin@whoon.com', 
    name: 'Melvin', 
    role: UserRole.SUPER_ADMIN, 
    isActive: true,
    isPasswordSet: true,
    password: 'Meubilex123!',
    createdAt: currentMonth
  }
];
