import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyRouteSeo } from '../lib/seo';

export function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    applyRouteSeo(pathname);
  }, [pathname]);

  return null;
}
