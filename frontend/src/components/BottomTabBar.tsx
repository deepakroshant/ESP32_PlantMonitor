import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PlantIcon } from './icons/PlantIcon'

export type DashboardTab = 'dashboard' | 'settings'

type Props = {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
}

export function BottomTabBar({ activeTab, onTabChange }: Props) {
  const location = useLocation()
  const showBar = location.pathname === '/'

  if (!showBar) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center border-t border-forest/8 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
      aria-label="Main navigation"
    >
      <div className="flex w-full max-w-md items-center justify-around py-2">
        <button
          type="button"
          onClick={() => onTabChange('dashboard')}
          className={`relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-xl px-6 py-2 transition-colors ${
            activeTab === 'dashboard'
              ? 'text-primary dark:text-primary-300'
              : 'text-forest/40 hover:text-forest/60 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          aria-label="Dashboard"
        >
          <PlantIcon className="h-5 w-5" />
          <span className="text-xs font-medium">Dashboard</span>
          {activeTab === 'dashboard' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary dark:bg-primary-400"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => onTabChange('settings')}
          className={`relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-xl px-6 py-2 transition-colors ${
            activeTab === 'settings'
              ? 'text-primary dark:text-primary-300'
              : 'text-forest/40 hover:text-forest/60 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
          aria-current={activeTab === 'settings' ? 'page' : undefined}
          aria-label="Settings"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-medium">Settings</span>
          {activeTab === 'settings' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary dark:bg-primary-400"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      </div>
    </nav>
  )
}
