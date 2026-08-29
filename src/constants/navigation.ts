import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Clock,
  Database,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  Leaf,
  MapPin,
  Route,
  ShieldCheck,
  Timer,
  TreePine,
  UserCheck,
  Users,
  ClipboardList,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  sub: string;
  path: string;
  icon: LucideIcon;
  /** Hanya tampil untuk user admin (kmdimcc@gmail.com) */
  adminOnly?: boolean;
  /** Disembunyikan untuk user TAM (toyotaastra@kmdi.co.id) */
  tamHidden?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: BarChart3,
    items: [
      { id: 'journal-trip', label: 'Journal Trip', sub: 'Ritase & Driver Tracking', path: '/journal-trip', icon: Route },
      { id: 'fleet-monitoring', label: 'Fleet Monitoring', sub: 'Live Status & Schedule', path: '/monitoring', icon: Activity },
      { id: 'eco-driving', label: 'Eco Driving', sub: 'Safety Analytics', path: '/eco', icon: Leaf },
      { id: 'leadtime', label: 'LeadTime', sub: 'Performance Analytics', path: '/leadtime', icon: Clock },
      { id: 'route-analytics', label: 'Route Analytics', sub: 'Segment Analysis', path: '/route-analytics', icon: MapPin },
      { id: 'carbon', label: 'Carbon Neutral', sub: 'Carbon Footprint', path: '/carbon', icon: TreePine, tamHidden: true },
    ],
  },
  {
    id: 'kesehatan',
    label: 'Kesehatan',
    icon: HeartPulse,
    items: [
      { id: 'tenko', label: 'Tenko', sub: 'Health Check', path: '/tenko', icon: Activity },
      { id: 'p2h', label: 'P2H & Gatepass', sub: 'Pemeriksaan Kendaraan', path: '/p2h', icon: ClipboardList },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    icon: Database,
    items: [
      { id: 'dashboard', label: 'Dashboard', sub: 'Overview', path: '/dashboard', icon: LayoutDashboard },
      { id: 'drivers', label: 'Drivers', sub: 'Data Pengemudi', path: '/drivers', icon: Users, tamHidden: true },
      { id: 'driver-analytics', label: 'Driver Analytics', sub: 'Violations & Coaching', path: '/driver-analytics', icon: UserCheck },
      { id: 'standar-leadtime', label: 'Standar Leadtime', sub: 'Reference Guide', path: '/standar-leadtime', icon: Timer },
      { id: 'training', label: 'Training Center', sub: 'Analytics', path: '/training', icon: GraduationCap },
      { id: 'kr-schedule', label: 'Jadwal KR', sub: 'Operasional', path: '/kr-schedule', icon: ShieldCheck },
      { id: 'kr-report', label: 'Report KR', sub: 'SOP, APD & Incident', path: '/kr-report', icon: ClipboardCheck, tamHidden: true },
      { id: 'admin-drivers', label: 'Admin Foto', sub: 'Manajemen Driver', path: '/admin-drivers', icon: Users, adminOnly: true },
    ],
  },
];

export function filterNavGroups(isTAM: boolean, isAdmin: boolean): NavGroup[] {
  return NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.adminOnly && !isAdmin) return false;
        if (item.tamHidden && isTAM) return false;
        return true;
      }),
    }))
    .filter(group => group.items.length > 0);
}
