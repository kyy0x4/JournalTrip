import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Clock,
  Database,
  GraduationCap,
  HeartPulse,
  Home,
  LayoutDashboard,
  Leaf,
  MapPin,
  Route,
  ShieldCheck,
  Timer,
  TreePine,
  Truck,
  UserCheck,
  Users,
  ClipboardList,
} from 'lucide-react';
import type { TranslationKey } from '../i18n';

export interface NavItem {
  id: string;
  labelKey: TranslationKey;
  subKey: TranslationKey;
  path: string;
  icon: LucideIcon;
  /** Hanya tampil untuk user admin — email diatur di constants/roles.ts */
  adminOnly?: boolean;
  /** Disembunyikan untuk user TAM — email diatur di constants/roles.ts */
  tamHidden?: boolean;
}

export interface NavGroup {
  id: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'beranda',
    labelKey: 'nav.group.beranda',
    icon: Home,
    items: [
      { id: 'beranda', labelKey: 'nav.beranda.label', subKey: 'nav.beranda.sub', path: '/beranda', icon: Home },
    ],
  },
  {
    id: 'monitoring',
    labelKey: 'nav.group.monitoring',
    icon: BarChart3,
    items: [
      { id: 'journal-trip', labelKey: 'nav.journalTrip.label', subKey: 'nav.journalTrip.sub', path: '/journal-trip', icon: Route },
      { id: 'fleet-monitoring', labelKey: 'nav.fleet.label', subKey: 'nav.fleet.sub', path: '/monitoring', icon: Activity },
      { id: 'eco-driving', labelKey: 'nav.eco.label', subKey: 'nav.eco.sub', path: '/eco', icon: Leaf },
      { id: 'leadtime', labelKey: 'nav.leadtime.label', subKey: 'nav.leadtime.sub', path: '/leadtime', icon: Clock },
      { id: 'route-analytics', labelKey: 'nav.routeAnalytics.label', subKey: 'nav.routeAnalytics.sub', path: '/route-analytics', icon: MapPin },
      { id: 'carbon', labelKey: 'nav.carbon.label', subKey: 'nav.carbon.sub', path: '/carbon', icon: TreePine, tamHidden: true },
    ],
  },
  {
    id: 'kesehatan',
    labelKey: 'nav.group.kesehatan',
    icon: HeartPulse,
    items: [
      { id: 'tenko', labelKey: 'nav.tenko.label', subKey: 'nav.tenko.sub', path: '/tenko', icon: Activity },
      { id: 'p2h', labelKey: 'nav.p2h.label', subKey: 'nav.p2h.sub', path: '/p2h', icon: ClipboardList },
    ],
  },
  {
    id: 'data',
    labelKey: 'nav.group.data',
    icon: Database,
    items: [
      { id: 'dashboard', labelKey: 'nav.dashboard.label', subKey: 'nav.dashboard.sub', path: '/dashboard', icon: LayoutDashboard },
      { id: 'drivers', labelKey: 'nav.drivers.label', subKey: 'nav.drivers.sub', path: '/drivers', icon: Users, tamHidden: true },
      { id: 'driver-analytics', labelKey: 'nav.driverAnalytics.label', subKey: 'nav.driverAnalytics.sub', path: '/driver-analytics', icon: UserCheck },
      { id: 'standar-parameter', labelKey: 'nav.standar.label', subKey: 'nav.standar.sub', path: '/standar-parameter', icon: Timer },
      { id: 'training', labelKey: 'nav.training.label', subKey: 'nav.training.sub', path: '/training', icon: GraduationCap },
      { id: 'kr-schedule', labelKey: 'nav.krSchedule.label', subKey: 'nav.krSchedule.sub', path: '/kr-schedule', icon: ShieldCheck },
      { id: 'kr-report', labelKey: 'nav.krReport.label', subKey: 'nav.krReport.sub', path: '/kr-report', icon: ClipboardCheck, tamHidden: true },
      { id: 'kr-loading', labelKey: 'nav.krLoading.label', subKey: 'nav.krLoading.sub', path: '/kr-loading', icon: Truck, tamHidden: true },
      { id: 'admin-drivers', labelKey: 'nav.adminDrivers.label', subKey: 'nav.adminDrivers.sub', path: '/admin-drivers', icon: Users, adminOnly: true },
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
