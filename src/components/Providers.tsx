// Type Imports
import type { ChildrenType, Direction } from '@core/types'

// Context Imports
import { VerticalNavProvider } from '@menu/contexts/verticalNavContext'
import { SettingsProvider } from '@core/contexts/settingsContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { BranchProvider } from '@/contexts/BranchContext'
import ThemeProvider from '@components/theme'
import BranchThemeSync from '@components/BranchThemeSync'

// Util Imports
import { getMode, getSettingsFromCookie, getSystemMode } from '@core/utils/serverHelpers'
import { ReactQueryProvider } from './auth/ReactQueryProvider'

type Props = ChildrenType & {
  direction: Direction
}

const Providers = async (props: Props) => {
  // Props
  const { children, direction } = props

  // Vars
  const mode = await getMode()
  const settingsCookie = await getSettingsFromCookie()
  const systemMode = await getSystemMode()

  return (
    <ReactQueryProvider>
      <AuthProvider>
        <BranchProvider>
          <VerticalNavProvider>
            <SettingsProvider settingsCookie={settingsCookie} mode={mode}>
              <ThemeProvider direction={direction} systemMode={systemMode}>
                <BranchThemeSync />
                {children}
              </ThemeProvider>
            </SettingsProvider>
          </VerticalNavProvider>
        </BranchProvider>
      </AuthProvider>
    </ReactQueryProvider>
  )
}

export default Providers
