import { useContext } from 'react';
import { DIContext } from './DIContext';

export function useService<T>(token: symbol): T {
  const container = useContext(DIContext);
  return container.resolve<T>(token);
}
