import React, { createContext } from 'react';
import { Container, defaultContainer } from '@core/di/container';
import { setupContainer } from '@core/di/bootstrap';

export const containerInstance = setupContainer(defaultContainer);

export const DIContext = createContext<Container>(containerInstance);

export const DIProvider: React.FC<{ container?: Container; children: React.ReactNode }> = ({
  container = containerInstance,
  children,
}) => {
  return <DIContext.Provider value={container}>{children}</DIContext.Provider>;
};

export { useService } from './useService';
