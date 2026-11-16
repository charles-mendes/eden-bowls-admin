import { useAuth } from '../contexts/AuthContext'

// Raw stored JSON is for the admin only: operators (Brazil and US) work from the readable sections around it.
// A screen choice, not access control: the API still returns these fields to whoever may read the record.
export function useShowsTechnicalJson() {
  const { hasRole } = useAuth()
  return hasRole('admin')
}
