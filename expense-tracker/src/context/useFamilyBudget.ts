import { useContext } from 'react';
import { FamilyBudgetContext } from './family-budget-context';

export function useFamilyBudget() {
  const context = useContext(FamilyBudgetContext);
  if (!context) throw new Error('useFamilyBudget must be used within FamilyBudgetProvider');
  return context;
}
