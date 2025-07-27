import React, { useEffect, useState } from 'react';

interface LazyPresentationWrapperProps {
  children: React.ComponentType<any>;
  components: any;
}

export default function LazyPresentationWrapper({ children: Component, components }: LazyPresentationWrapperProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Force a re-render after mount to ensure Spectacle initializes
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 10);

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <div style={{ opacity: 0 }}><Component components={components} /></div>;
  }

  return <Component components={components} />;
}