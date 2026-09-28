import { useContext } from 'react'
import { MarketplaceContext } from './MarketplaceStore'

export function useMarketplace() {
  const context = useContext(MarketplaceContext)
  if (!context) throw new Error('useMarketplace must be used inside MarketplaceProvider')
  return context
}
